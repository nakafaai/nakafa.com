import { api } from "@repo/backend/convex/_generated/api";
import type { mathWorkResultValidator } from "@repo/backend/convex/math/spec";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";
import type { Infer } from "convex/values";
import { describe, expect, it } from "vitest";

const NOW = Date.UTC(2026, 5, 24, 9, 0, 0);
type MathWorkResultInput = Infer<typeof mathWorkResultValidator>;

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
      steps: await ctx.db.query("mathWorkSteps").collect(),
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
  });
});

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
          advanced: { key: "math-step-advanced", values: [] },
          atomic: { key: "math-step-atomic", values: [] },
          professor: { key: "math-step-professor", values: [] },
          school: { key: "math-step-school", values: [] },
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
      createdAt: NOW,
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
