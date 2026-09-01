import { describe, expect, it } from "@effect/vitest";
import { api } from "@repo/backend/convex/_generated/api";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";
import { saveTryoutResponse } from "@repo/backend/convex/tryouts/response/impl";
import type { TryoutStatus } from "@repo/backend/convex/tryouts/status";
import { seedTryoutContentAccessState } from "@repo/backend/test/tryout/runtime";
import { TRYOUT_TEST_NOW } from "@repo/backend/test/tryouts";

type ConvexTest = ReturnType<typeof createConvexTestWithBetterAuth>;

/** Seeds one active placement and returns its immutable choice snapshots. */
async function seedResponseFixture(
  t: ConvexTest,
  suffix: string,
  status: {
    readonly attempt?: TryoutStatus;
    readonly section?: TryoutStatus;
  } = {}
) {
  return await t.mutation(async (ctx) => {
    const seeded = await seedTryoutContentAccessState(ctx, {
      attemptStatus: status.attempt ?? "in-progress",
      sectionStatus: status.section ?? "in-progress",
      suffix,
    });
    const placement = await ctx.db.get(seeded.placementId);
    if (!placement) {
      throw new Error("Expected a seeded try-out placement.");
    }
    return {
      ...seeded,
      choices: placement.choiceSnapshots,
    };
  });
}

/** Requires the first immutable choice in one response fixture. */
function requireFirstChoice<T>(choices: readonly T[]) {
  const choice = choices.at(0);
  if (!choice) {
    throw new Error("Expected one frozen choice.");
  }
  return choice;
}

/** Returns an authenticated test client for one seeded app user. */
function authenticate(
  t: ConvexTest,
  identity: { readonly authUserId: string; readonly sessionId: string }
) {
  return t.withIdentity({
    sessionId: identity.sessionId,
    subject: identity.authUserId,
  });
}

describe("tryouts/response/impl", () => {
  it("stores server-derived elapsed time and preserves first-answer time", async () => {
    const t = createConvexTestWithBetterAuth();
    const seeded = await seedResponseFixture(t, "response-time");
    const selectedChoice = requireFirstChoice(seeded.choices);
    const authed = authenticate(t, seeded.identity);

    vi.setSystemTime(new Date(TRYOUT_TEST_NOW + 5000));
    await authed.mutation(api.tryouts.mutations.responses.save, {
      placementId: seeded.placementId,
      selectedOptionId: selectedChoice.optionKey,
    });

    vi.setSystemTime(new Date(TRYOUT_TEST_NOW + 9000));
    await authed.mutation(api.tryouts.mutations.responses.save, {
      placementId: seeded.placementId,
      selectedOptionId: selectedChoice.optionKey,
    });

    const stored = await t.query(async (ctx) => {
      const responses = await ctx.db.query("tryoutResponses").collect();
      return {
        attempt: await ctx.db.get(seeded.attemptId),
        responses,
        section: await ctx.db.get(seeded.sectionAttemptId),
      };
    });
    expect(stored.responses).toHaveLength(1);
    expect(stored.responses[0]).toMatchObject({
      answeredAt: TRYOUT_TEST_NOW + 5000,
      isCorrect: selectedChoice.isCorrect,
      selectedOptionId: selectedChoice.optionKey,
      timeSpent: 9,
      updatedAt: TRYOUT_TEST_NOW + 9000,
    });
    expect(stored.section).toMatchObject({
      answeredCount: 1,
      correctAnswers: selectedChoice.isCorrect ? 1 : 0,
      lastActivityAt: TRYOUT_TEST_NOW + 9000,
    });
    expect(stored.attempt?.lastActivityAt).toBe(TRYOUT_TEST_NOW + 9000);
  });

  it("rejects choices outside the frozen placement without mutating state", async () => {
    const t = createConvexTestWithBetterAuth();
    const seeded = await seedResponseFixture(t, "response-choice");
    const authed = authenticate(t, seeded.identity);
    vi.setSystemTime(new Date(TRYOUT_TEST_NOW + 5000));

    await expect(
      authed.mutation(api.tryouts.mutations.responses.save, {
        placementId: seeded.placementId,
        selectedOptionId: "",
      })
    ).rejects.toMatchObject({ data: { code: "TRYOUT_CHOICE_NOT_FOUND" } });
    await expect(
      authed.mutation(api.tryouts.mutations.responses.save, {
        placementId: seeded.placementId,
        selectedOptionId: "option-999",
      })
    ).rejects.toMatchObject({ data: { code: "TRYOUT_CHOICE_NOT_FOUND" } });

    const stored = await t.query(async (ctx) => ({
      responses: await ctx.db.query("tryoutResponses").collect(),
      section: await ctx.db.get(seeded.sectionAttemptId),
    }));
    expect(stored.responses).toEqual([]);
    expect(stored.section).toMatchObject({
      answeredCount: 0,
      correctAnswers: 0,
      lastActivityAt: TRYOUT_TEST_NOW,
    });
  });

  it("accepts the pre-expiry boundary and rejects expiry without overwrite", async () => {
    const t = createConvexTestWithBetterAuth();
    const seeded = await seedResponseFixture(t, "response-expiry");
    const selectedChoice = requireFirstChoice(seeded.choices);
    const authed = authenticate(t, seeded.identity);

    vi.setSystemTime(new Date(TRYOUT_TEST_NOW + 1_799_999));
    await authed.mutation(api.tryouts.mutations.responses.save, {
      placementId: seeded.placementId,
      selectedOptionId: selectedChoice.optionKey,
    });
    vi.setSystemTime(new Date(TRYOUT_TEST_NOW + 1_800_000));
    await expect(
      authed.mutation(api.tryouts.mutations.responses.save, {
        placementId: seeded.placementId,
        selectedOptionId: selectedChoice.optionKey,
      })
    ).rejects.toMatchObject({ data: { code: "TRYOUT_EXPIRED" } });

    const responses = await t.query((ctx) =>
      ctx.db.query("tryoutResponses").collect()
    );
    expect(responses).toHaveLength(1);
    expect(responses[0]).toMatchObject({
      answeredAt: TRYOUT_TEST_NOW + 1_799_999,
      selectedOptionId: selectedChoice.optionKey,
      timeSpent: 1799,
      updatedAt: TRYOUT_TEST_NOW + 1_799_999,
    });
  });

  it("rejects a different user before writing a response", async () => {
    const t = createConvexTestWithBetterAuth();
    const seeded = await seedResponseFixture(t, "response-owner");
    const selectedChoice = requireFirstChoice(seeded.choices);
    const outsider = await t.mutation((ctx) =>
      seedAuthenticatedUser(ctx, {
        now: TRYOUT_TEST_NOW,
        suffix: "response-outsider",
      })
    );
    const authed = authenticate(t, outsider);

    await expect(
      authed.mutation(api.tryouts.mutations.responses.save, {
        placementId: seeded.placementId,
        selectedOptionId: selectedChoice.optionKey,
      })
    ).rejects.toMatchObject({ data: { code: "TRYOUT_ATTEMPT_NOT_FOUND" } });
    await expect(
      t.query((ctx) => ctx.db.query("tryoutResponses").collect())
    ).resolves.toEqual([]);
  });

  it("masks an unexpected attempt lookup failure", async () => {
    const t = createConvexTestWithBetterAuth();
    const seeded = await seedResponseFixture(t, "response-storage-failure");
    const selectedChoice = requireFirstChoice(seeded.choices);

    await expect(
      t.mutation(async (ctx) => {
        const placement = await ctx.db.get(seeded.placementId);
        if (!placement) {
          throw new Error("Expected one frozen placement.");
        }
        const get = vi.spyOn(ctx.db, "get");
        get.mockResolvedValueOnce(placement);
        get.mockRejectedValueOnce(
          new Error("internal tryoutAttempts storage details")
        );

        return await runConvexProgram(
          saveTryoutResponse(ctx, {
            args: {
              placementId: seeded.placementId,
              selectedOptionId: selectedChoice.optionKey,
            },
            now: TRYOUT_TEST_NOW + 5000,
            userId: seeded.identity.userId,
          })
        );
      })
    ).rejects.toMatchObject({
      data: {
        code: "TRYOUT_RESPONSE_FAILED",
        message: "Unable to save try-out response.",
      },
    });
  });

  it.each([
    {
      expectedCode: "TRYOUT_ATTEMPT_NOT_ACTIVE",
      status: { attempt: "completed" as const },
      suffix: "inactive-attempt",
    },
    {
      expectedCode: "TRYOUT_SECTION_NOT_ACTIVE",
      status: { section: "completed" as const },
      suffix: "inactive-section",
    },
  ])(
    "rejects $suffix before writing a response",
    async ({ expectedCode, status, suffix }) => {
      const t = createConvexTestWithBetterAuth();
      const seeded = await seedResponseFixture(t, suffix, status);
      const selectedChoice = requireFirstChoice(seeded.choices);
      const authed = authenticate(t, seeded.identity);

      await expect(
        authed.mutation(api.tryouts.mutations.responses.save, {
          placementId: seeded.placementId,
          selectedOptionId: selectedChoice.optionKey,
        })
      ).rejects.toMatchObject({ data: { code: expectedCode } });
      await expect(
        t.query((ctx) => ctx.db.query("tryoutResponses").collect())
      ).resolves.toEqual([]);
    }
  );

  it.each([
    {
      expectedCode: "TRYOUT_RESPONSE_LINK_MISMATCH",
      suffix: "placement-snapshot-mismatch",
      target: "placement" as const,
    },
    {
      expectedCode: "TRYOUT_SECTION_ATTEMPT_SNAPSHOT_MISMATCH",
      suffix: "section-snapshot-mismatch",
      target: "section" as const,
    },
  ])(
    "rejects a $target snapshot mismatch before writing a response",
    async ({ expectedCode, suffix, target }) => {
      const t = createConvexTestWithBetterAuth();
      const seeded = await seedResponseFixture(t, suffix);
      const selectedChoice = requireFirstChoice(seeded.choices);
      await t.mutation((ctx) => {
        if (target === "placement") {
          return ctx.db.patch(seeded.placementId, {
            sectionIdentity: "corrupt-section-identity",
          });
        }

        return ctx.db.patch(seeded.sectionAttemptId, { sectionOrder: 999 });
      });
      const authed = authenticate(t, seeded.identity);

      await expect(
        authed.mutation(api.tryouts.mutations.responses.save, {
          placementId: seeded.placementId,
          selectedOptionId: selectedChoice.optionKey,
        })
      ).rejects.toMatchObject({ data: { code: expectedCode } });
      const stored = await t.query(async (ctx) => ({
        attempt: await ctx.db.get(seeded.attemptId),
        responses: await ctx.db.query("tryoutResponses").collect(),
        section: await ctx.db.get(seeded.sectionAttemptId),
      }));
      expect(stored.responses).toEqual([]);
      expect(stored.section).toMatchObject({
        answeredCount: 0,
        correctAnswers: 0,
        lastActivityAt: TRYOUT_TEST_NOW,
      });
      expect(stored.attempt?.lastActivityAt).toBe(TRYOUT_TEST_NOW);
    }
  );

  it("rejects a cross-linked existing response without counter changes", async () => {
    const t = createConvexTestWithBetterAuth();
    const seeded = await seedResponseFixture(t, "response-link");
    const selectedChoice = requireFirstChoice(seeded.choices);
    await t.mutation(async (ctx) => {
      const attempt = await ctx.db.get(seeded.attemptId);
      const section = await ctx.db.get(seeded.sectionAttemptId);
      if (!(attempt && section)) {
        throw new Error("Expected one attempt and section attempt.");
      }
      const { _creationTime, _id, ...attemptValues } = attempt;
      const foreignAttemptId = await ctx.db.insert(
        "tryoutAttempts",
        attemptValues
      );
      const foreignSectionId = await ctx.db.insert("tryoutSectionAttempts", {
        answeredCount: 0,
        completedAt: null,
        correctAnswers: 0,
        endReason: null,
        expiresAt: section.expiresAt,
        lastActivityAt: section.lastActivityAt,
        sectionIdentity: section.sectionIdentity,
        sectionKey: section.sectionKey,
        sectionOrder: section.sectionOrder,
        startedAt: section.startedAt,
        status: "in-progress",
        totalQuestions: section.totalQuestions,
        tryoutAttemptId: foreignAttemptId,
      });
      await ctx.db.insert("tryoutResponses", {
        answeredAt: TRYOUT_TEST_NOW,
        isCorrect: selectedChoice.isCorrect,
        placementId: seeded.placementId,
        selectedOptionId: selectedChoice.optionKey,
        timeSpent: 0,
        tryoutAttemptId: seeded.attemptId,
        tryoutSectionAttemptId: foreignSectionId,
        updatedAt: TRYOUT_TEST_NOW,
      });
    });
    const authed = authenticate(t, seeded.identity);
    vi.setSystemTime(new Date(TRYOUT_TEST_NOW + 5000));

    await expect(
      authed.mutation(api.tryouts.mutations.responses.save, {
        placementId: seeded.placementId,
        selectedOptionId: selectedChoice.optionKey,
      })
    ).rejects.toMatchObject({
      data: { code: "TRYOUT_RESPONSE_LINK_MISMATCH" },
    });
    const stored = await t.query(async (ctx) => ({
      attempt: await ctx.db.get(seeded.attemptId),
      response: await ctx.db
        .query("tryoutResponses")
        .withIndex("by_placementId", (index) =>
          index.eq("placementId", seeded.placementId)
        )
        .unique(),
      section: await ctx.db.get(seeded.sectionAttemptId),
    }));
    expect(stored.response?.updatedAt).toBe(TRYOUT_TEST_NOW);
    expect(stored.section).toMatchObject({
      answeredCount: 0,
      correctAnswers: 0,
      lastActivityAt: TRYOUT_TEST_NOW,
    });
    expect(stored.attempt?.lastActivityAt).toBe(TRYOUT_TEST_NOW);
  });

  it("rejects duplicate placement responses before any overwrite", async () => {
    const t = createConvexTestWithBetterAuth();
    const seeded = await seedResponseFixture(t, "response-duplicate");
    const selectedChoice = requireFirstChoice(seeded.choices);
    await t.mutation(async (ctx) => {
      for (const offset of [0, 1]) {
        await ctx.db.insert("tryoutResponses", {
          answeredAt: TRYOUT_TEST_NOW + offset,
          isCorrect: selectedChoice.isCorrect,
          placementId: seeded.placementId,
          selectedOptionId: selectedChoice.optionKey,
          timeSpent: offset,
          tryoutAttemptId: seeded.attemptId,
          tryoutSectionAttemptId: seeded.sectionAttemptId,
          updatedAt: TRYOUT_TEST_NOW + offset,
        });
      }
    });
    const authed = authenticate(t, seeded.identity);
    vi.setSystemTime(new Date(TRYOUT_TEST_NOW + 5000));

    await expect(
      authed.mutation(api.tryouts.mutations.responses.save, {
        placementId: seeded.placementId,
        selectedOptionId: selectedChoice.optionKey,
      })
    ).rejects.toMatchObject({
      data: { code: "TRYOUT_RESPONSE_PLACEMENT_DUPLICATE" },
    });
    const stored = await t.query(async (ctx) => ({
      attempt: await ctx.db.get(seeded.attemptId),
      responses: await ctx.db.query("tryoutResponses").collect(),
      section: await ctx.db.get(seeded.sectionAttemptId),
    }));
    expect(stored.responses.map(({ updatedAt }) => updatedAt)).toEqual([
      TRYOUT_TEST_NOW,
      TRYOUT_TEST_NOW + 1,
    ]);
    expect(stored.section?.lastActivityAt).toBe(TRYOUT_TEST_NOW);
    expect(stored.attempt?.lastActivityAt).toBe(TRYOUT_TEST_NOW);
  });

  it("rejects stale stored correctness before any overwrite", async () => {
    const t = createConvexTestWithBetterAuth();
    const seeded = await seedResponseFixture(t, "response-correctness");
    const selectedChoice = requireFirstChoice(seeded.choices);
    await t.mutation((ctx) =>
      ctx.db.insert("tryoutResponses", {
        answeredAt: TRYOUT_TEST_NOW,
        isCorrect: !selectedChoice.isCorrect,
        placementId: seeded.placementId,
        selectedOptionId: selectedChoice.optionKey,
        timeSpent: 0,
        tryoutAttemptId: seeded.attemptId,
        tryoutSectionAttemptId: seeded.sectionAttemptId,
        updatedAt: TRYOUT_TEST_NOW,
      })
    );
    const authed = authenticate(t, seeded.identity);
    vi.setSystemTime(new Date(TRYOUT_TEST_NOW + 5000));

    await expect(
      authed.mutation(api.tryouts.mutations.responses.save, {
        placementId: seeded.placementId,
        selectedOptionId: selectedChoice.optionKey,
      })
    ).rejects.toMatchObject({
      data: { code: "TRYOUT_RESPONSE_CHOICE_MISMATCH" },
    });
    const stored = await t.query(async (ctx) => ({
      attempt: await ctx.db.get(seeded.attemptId),
      response: await ctx.db.query("tryoutResponses").unique(),
      section: await ctx.db.get(seeded.sectionAttemptId),
    }));
    expect(stored.response).toMatchObject({
      isCorrect: !selectedChoice.isCorrect,
      updatedAt: TRYOUT_TEST_NOW,
    });
    expect(stored.section?.lastActivityAt).toBe(TRYOUT_TEST_NOW);
    expect(stored.attempt?.lastActivityAt).toBe(TRYOUT_TEST_NOW);
  });
});
