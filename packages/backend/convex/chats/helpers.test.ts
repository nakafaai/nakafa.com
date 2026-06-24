import { chatResponseFailureCode } from "@repo/ai/config/generation";
import { api, internal } from "@repo/backend/convex/_generated/api";
import type {
  mathPedagogyProjectionValidator,
  mathWorkResultValidator,
} from "@repo/backend/convex/math/spec";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";
import type { Infer } from "convex/values";
import { describe, expect, it } from "vitest";

const NOW = Date.UTC(2026, 5, 24, 9, 0, 0);
type MathWorkResultInput = Infer<typeof mathWorkResultValidator>;
type MathPedagogyProjectionInput = Infer<
  typeof mathPedagogyProjectionValidator
>;

describe("chat transcript MathWork cleanup", () => {
  it("deletes normalized math evidence when a generated tail is rewritten", async () => {
    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation(
      async (ctx) =>
        await seedAuthenticatedUser(ctx, {
          now: NOW,
          suffix: "math-cleanup",
        })
    );
    const owner = t.withIdentity({
      sessionId: identity.sessionId,
      subject: identity.authUserId,
    });
    const { chatId } = await owner.mutation(
      api.chats.mutations.createChatWithMessage,
      {
        message: {
          identifier: "user-rewrite",
          modelId: "nakafa-lite",
          role: "user",
        },
        parts: [],
        type: "study",
      }
    );

    await t.mutation(async (ctx) => {
      await ctx.db.insert("messages", {
        chatId,
        generationStatus: "complete",
        identifier: "assistant-tail",
        modelId: "nakafa-lite",
        role: "assistant",
      });
    });
    await owner.mutation(api.math.mutations.save, {
      chatId,
      responseMessageIdentifier: "assistant-tail",
      result: mathWorkResult(),
      toolCallId: "tool-cleanup",
    });
    await owner.mutation(api.math.mutations.savePedagogyProjection, {
      chatId,
      projection: mathPedagogyProjection(),
      responseMessageIdentifier: "assistant-tail",
      toolCallId: "tool-cleanup",
    });
    await t.mutation(async (ctx) => {
      await ctx.db.insert("ninaCapabilityTraces", {
        capability: "math",
        chatId,
        durationMs: 8,
        endedAt: NOW,
        evidence: {
          capability: "math",
          refs: ["math:cleanup:test"],
          status: "available",
          summary: "math capability produced deterministic work",
        },
        expiresAt: NOW + 1000,
        responseMessageIdentifier: "assistant-tail",
        startedAt: NOW - 8,
        status: "available",
        toolCallId: "tool-cleanup",
        userId: identity.userId,
      });
    });

    await owner.mutation(api.chats.mutations.saveMessage, {
      message: {
        chatId,
        identifier: "user-rewrite",
        modelId: "nakafa-lite",
        role: "user",
      },
      parts: [],
    });

    const rows = await t.query(async (ctx) => ({
      artifacts: await ctx.db.query("mathWorkArtifacts").collect(),
      computations: await ctx.db.query("mathComputations").collect(),
      messages: await ctx.db.query("messages").collect(),
      pedagogy: await ctx.db.query("mathPedagogyProjections").collect(),
      steps: await ctx.db.query("mathWorkSteps").collect(),
      traces: await ctx.db.query("ninaCapabilityTraces").collect(),
      works: await ctx.db.query("mathWorks").collect(),
    }));

    expect(rows.messages).toEqual([
      expect.objectContaining({
        chatId,
        identifier: "user-rewrite",
        role: "user",
      }),
    ]);
    expect(rows.works).toEqual([]);
    expect(rows.computations).toEqual([]);
    expect(rows.steps).toEqual([]);
    expect(rows.artifacts).toEqual([]);
    expect(rows.pedagogy).toEqual([]);
    expect(rows.traces).toEqual([]);
  });

  it("deletes detached MathWork when an assistant stream fails", async () => {
    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation(
      async (ctx) =>
        await seedAuthenticatedUser(ctx, {
          now: NOW,
          suffix: "math-failure-cleanup",
        })
    );
    const owner = t.withIdentity({
      sessionId: identity.sessionId,
      subject: identity.authUserId,
    });
    const { chatId } = await owner.mutation(
      api.chats.mutations.createChatWithMessage,
      {
        message: {
          identifier: "user-before-failure",
          modelId: "nakafa-lite",
          role: "user",
        },
        parts: [],
        type: "study",
      }
    );

    await owner.mutation(api.math.mutations.save, {
      chatId,
      responseMessageIdentifier: "assistant-failed",
      result: mathWorkResult(),
      toolCallId: "tool-failed",
    });
    await owner.mutation(api.math.mutations.savePedagogyProjection, {
      chatId,
      projection: mathPedagogyProjection(),
      responseMessageIdentifier: "assistant-failed",
      toolCallId: "tool-failed",
    });
    await t.mutation(async (ctx) => {
      await ctx.db.insert("ninaCapabilityTraces", {
        capability: "math",
        chatId,
        durationMs: 5,
        endedAt: NOW,
        evidence: {
          capability: "math",
          refs: ["math:cleanup:test"],
          status: "available",
          summary: "math capability produced deterministic work",
        },
        expiresAt: NOW + 1000,
        responseMessageIdentifier: "assistant-failed",
        startedAt: NOW - 5,
        status: "available",
        toolCallId: "tool-failed",
        userId: identity.userId,
      });
    });
    await t.mutation(internal.chats.mutations.saveAssistantFailure, {
      message: {
        chatId,
        generationErrorCode: chatResponseFailureCode,
        identifier: "assistant-failed",
        modelId: "nakafa-lite",
      },
      userId: identity.userId,
    });

    const rows = await t.query(async (ctx) => ({
      artifacts: await ctx.db.query("mathWorkArtifacts").collect(),
      computations: await ctx.db.query("mathComputations").collect(),
      messages: await ctx.db.query("messages").collect(),
      pedagogy: await ctx.db.query("mathPedagogyProjections").collect(),
      steps: await ctx.db.query("mathWorkSteps").collect(),
      traces: await ctx.db.query("ninaCapabilityTraces").collect(),
      works: await ctx.db.query("mathWorks").collect(),
    }));

    expect(rows.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          chatId,
          generationStatus: "failed",
          identifier: "assistant-failed",
          role: "assistant",
        }),
      ])
    );
    expect(rows.works).toEqual([]);
    expect(rows.computations).toEqual([]);
    expect(rows.steps).toEqual([]);
    expect(rows.artifacts).toEqual([]);
    expect(rows.pedagogy).toEqual([]);
    expect(rows.traces).toEqual([]);
  });
});

/** Builds a compact encoded PedagogyProjection tied to the saved MathWork. */
function mathPedagogyProjection(): MathPedagogyProjectionInput {
  return {
    evidenceHash: "evidence:cleanup",
    kind: "math-pedagogy-projection",
    locale: "en",
    model: {
      gatewayModelId: "google/gemini-3-flash",
      modelId: "nakafa-lite",
      promptVersion: "math.pedagogy.v1",
      provider: "ai-gateway",
      schemaVersion: "pedagogy.projection.v1",
    },
    narratedAt: NOW,
    sentences: [
      {
        evidenceRefs: ["math:cleanup:test:result:primary"],
        id: "math:cleanup:test:pedagogy:0",
        text: "The deterministic result is available for learner narration.",
      },
    ],
    workId: "math:cleanup:test",
  };
}

/** Builds a compact encoded MathWork result tied to one assistant response. */
function mathWorkResult(): MathWorkResultInput {
  return {
    artifacts: [
      {
        artifactId: "math:cleanup:test:formula",
        kind: "formula-card",
        manifest: {
          expressionRefs: ["primaryResult"],
          kind: "formula-card",
        },
        titleKey: "math-simplify",
        verificationLane: "verified",
        workId: "math:cleanup:test",
      },
    ],
    steps: [
      {
        input: { expression: "2x + 3x", latex: "2x+3x" },
        order: 0,
        output: { expression: "5x", latex: "5x" },
        projection: {
          advanced: {
            key: "math-step-simplify",
            values: [
              { name: "evidenceRef", value: "math:cleanup:test:step:0" },
            ],
          },
          atomic: {
            key: "math-step-simplify",
            values: [
              { name: "evidenceRef", value: "math:cleanup:test:step:0" },
            ],
          },
          professor: {
            key: "math-step-simplify",
            values: [
              { name: "evidenceRef", value: "math:cleanup:test:step:0" },
            ],
          },
          school: {
            key: "math-step-simplify",
            values: [
              { name: "evidenceRef", value: "math:cleanup:test:step:0" },
            ],
          },
        },
        projectionLevels: ["atomic", "school", "advanced", "professor"],
        ruleId: "cas.simplify",
        verificationLane: "derived",
        workId: "math:cleanup:test",
      },
    ],
    work: {
      assumptions: [],
      computations: [
        {
          conditions: [],
          input: {
            expression: "2x + 3x",
            kind: "math",
            operation: "simplify",
          },
          items: [],
          kind: "simplify",
          operation: "simplify",
          primary: { expression: "2x + 3x", latex: "2x+3x" },
          secondary: { expression: "5x", latex: "5x" },
          stepStatus: "complete",
          steps: [],
          status: "verified",
        },
      ],
      input: {
        givens: ["2x + 3x"],
        kind: "prompt",
        locale: "en",
        objective: "Simplify.",
        requirements: [],
        text: "simplify 2x + 3x",
      },
      limitations: [],
      plannedRequest: {
        expression: "2x + 3x",
        kind: "math",
        operation: "simplify",
      },
      primaryResult: { expression: "5x", latex: "5x" },
      status: "ready",
      verification: {
        engine: "sympy",
        lane: "verified",
        reasonKey: "math-verification-verified",
        source: "cas.simplify",
        values: [],
      },
      workId: "math:cleanup:test",
    },
  };
}
