import { api } from "@repo/backend/convex/_generated/api";
import type { mathWorkResultValidator } from "@repo/backend/convex/math/spec";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";
import type { Infer } from "convex/values";
import { describe, expect, it } from "vitest";

const NOW = Date.UTC(2026, 5, 23, 9, 0, 0);
type MathWorkResultInput = Infer<typeof mathWorkResultValidator>;

describe("math/MathWork read model", () => {
  it("persists replacement-safe normalized MathWork rows for the owner", async () => {
    const t = createConvexTestWithBetterAuth();
    const seeded = await t.mutation(async (ctx) => {
      const user = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "math-owner",
      });
      const chatId = await ctx.db.insert("chats", {
        title: "Math chat",
        type: "study",
        updatedAt: NOW,
        userId: user.userId,
        visibility: "private",
      });

      return { ...user, chatId };
    });
    const owner = t.withIdentity({
      sessionId: seeded.sessionId,
      subject: seeded.authUserId,
    });

    const firstSave = await owner.mutation(api.math.mutations.save, {
      chatId: seeded.chatId,
      responseMessageIdentifier: "response-1",
      result: mathWorkResult(),
      toolCallId: "tool-1",
    });
    const secondSave = await owner.mutation(api.math.mutations.save, {
      chatId: seeded.chatId,
      responseMessageIdentifier: "response-1",
      result: mathWorkResult(),
      toolCallId: "tool-1",
    });
    const stored = await owner.query(api.math.queries.get, {
      chatId: seeded.chatId,
      workId: "math:simplify:test",
    });
    const rows = await t.query(async (ctx) => ({
      artifacts: await ctx.db.query("mathWorkArtifacts").collect(),
      computations: await ctx.db.query("mathComputations").collect(),
      steps: await ctx.db.query("mathWorkSteps").collect(),
      works: await ctx.db.query("mathWorks").collect(),
    }));
    const firstStepPage = await owner.query(api.math.queries.listSteps, {
      chatId: seeded.chatId,
      paginationOpts: { cursor: null, numItems: 1 },
      workId: "math:simplify:test",
    });

    expect(firstSave).toEqual(secondSave);
    expect(stored?.work).toEqual(
      expect.objectContaining({
        responseMessageIdentifier: "response-1",
        toolCallId: "tool-1",
        userId: seeded.userId,
        workId: "math:simplify:test",
      })
    );
    expect(stored?.computations).toHaveLength(1);
    expect(stored?.artifacts).toHaveLength(2);
    expect(rows).toEqual({
      artifacts: expect.arrayContaining([
        expect.objectContaining({ artifactId: "math:simplify:test:formula" }),
        expect.objectContaining({ artifactId: "math:simplify:test:steps" }),
      ]),
      computations: [expect.objectContaining({ order: 0 })],
      steps: [
        expect.objectContaining({ order: 0 }),
        expect.objectContaining({ order: 1 }),
      ],
      works: [expect.objectContaining({ workId: "math:simplify:test" })],
    });
    expect(firstStepPage.page).toHaveLength(1);
    expect(firstStepPage.isDone).toBe(false);
  });

  it("rejects non-owner MathWork reads", async () => {
    const t = createConvexTestWithBetterAuth();
    const seeded = await t.mutation(async (ctx) => {
      const owner = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "math-private-owner",
      });
      const viewer = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "math-private-viewer",
      });
      const chatId = await ctx.db.insert("chats", {
        title: "Private math chat",
        type: "study",
        updatedAt: NOW,
        userId: owner.userId,
        visibility: "private",
      });

      return { chatId, owner, viewer };
    });
    const owner = t.withIdentity({
      sessionId: seeded.owner.sessionId,
      subject: seeded.owner.authUserId,
    });
    const viewer = t.withIdentity({
      sessionId: seeded.viewer.sessionId,
      subject: seeded.viewer.authUserId,
    });

    await owner.mutation(api.math.mutations.save, {
      chatId: seeded.chatId,
      result: mathWorkResult(),
    });

    await expect(
      viewer.query(api.math.queries.get, {
        chatId: seeded.chatId,
        workId: "math:simplify:test",
      })
    ).rejects.toThrow("FORBIDDEN");
  });

  it("derives child row work IDs from the root MathWork", async () => {
    const t = createConvexTestWithBetterAuth();
    const seeded = await t.mutation(async (ctx) => {
      const user = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "math-child-work-id",
      });
      const chatId = await ctx.db.insert("chats", {
        title: "Math chat",
        type: "study",
        updatedAt: NOW,
        userId: user.userId,
        visibility: "private",
      });

      return { ...user, chatId };
    });
    const owner = t.withIdentity({
      sessionId: seeded.sessionId,
      subject: seeded.authUserId,
    });

    await owner.mutation(api.math.mutations.save, {
      chatId: seeded.chatId,
      result: mathWorkResultWithMismatchedChildren(),
    });
    const rows = await t.query(async (ctx) => ({
      artifacts: await ctx.db.query("mathWorkArtifacts").collect(),
      steps: await ctx.db.query("mathWorkSteps").collect(),
    }));

    expect(rows.steps).toEqual([
      expect.objectContaining({ workId: "math:simplify:test" }),
      expect.objectContaining({ workId: "math:simplify:test" }),
    ]);
    expect(rows.artifacts).toEqual([
      expect.objectContaining({ workId: "math:simplify:test" }),
      expect.objectContaining({ workId: "math:simplify:test" }),
    ]);
  });
});

/** Builds a representative encoded MathWork result for Convex tests. */
function mathWorkResult(): MathWorkResultInput {
  return {
    artifacts: [
      {
        artifactId: "math:simplify:test:formula",
        kind: "formula-card",
        manifest: {
          expressionRefs: ["primaryResult"],
          kind: "formula-card",
        },
        titleKey: "math-simplify",
        verificationLane: "verified",
        workId: "math:simplify:test",
      },
      {
        artifactId: "math:simplify:test:steps",
        kind: "step-list",
        manifest: {
          kind: "step-list",
          projectionLevel: "school",
          stepOrders: [0, 1],
        },
        titleKey: "math-work-steps-title",
        verificationLane: "derived",
        workId: "math:simplify:test",
      },
    ],
    steps: [mathStep(0, "2x + 3x", "5x"), mathStep(1, "5x", "5 * x")],
    work: {
      assumptions: [
        {
          copyKey: "math-assumption-planned-from-prompt",
          lane: "pedagogical",
          values: [],
        },
      ],
      computations: [
        {
          conditions: [],
          input: {
            expression: "2 * x + 3 * x",
            kind: "math",
            operation: "simplify",
          },
          items: [],
          kind: "simplify",
          operation: "simplify",
          primary: {
            expression: "2 * x + 3 * x",
            latex: "2x+3x",
          },
          secondary: {
            expression: "5 * x",
            latex: "5x",
          },
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
        objective: "Simplify the expression.",
        text: "simplify 2x + 3x",
      },
      limitations: [],
      plannedRequest: {
        expression: "2 * x + 3 * x",
        kind: "math",
        operation: "simplify",
      },
      primaryResult: {
        expression: "5 * x",
        latex: "5x",
      },
      status: "ready",
      verification: {
        engine: "sympy",
        lane: "verified",
        reasonKey: "math-verification-verified",
        source: "cas.simplify",
        values: [],
      },
      workId: "math:simplify:test",
    },
  };
}

/** Builds a malformed public save payload to prove child IDs are normalized. */
function mathWorkResultWithMismatchedChildren(): MathWorkResultInput {
  const result = mathWorkResult();

  return {
    ...result,
    artifacts: result.artifacts.map((artifact) => ({
      ...artifact,
      workId: "math:simplify:orphan",
    })),
    steps: result.steps.map((step) => ({
      ...step,
      workId: "math:simplify:orphan",
    })),
  };
}

/** Builds one semantic derivation step fixture. */
function mathStep(
  order: number,
  input: string,
  output: string
): MathWorkResultInput["steps"][number] {
  return {
    input: { expression: input, latex: input },
    order,
    output: { expression: output, latex: output },
    projection: {
      advanced: { key: "math-step-advanced", values: [] },
      atomic: { key: "math-step-atomic", values: [] },
      professor: { key: "math-step-professor", values: [] },
      school: { key: "math-step-school", values: [] },
    },
    projectionLevels: ["atomic", "school", "advanced", "professor"],
    ruleId: "cas.simplify",
    verificationLane: "derived",
    workId: "math:simplify:test",
  };
}
