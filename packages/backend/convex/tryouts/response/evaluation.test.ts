import { describe, expect, it } from "@effect/vitest";
import { api } from "@repo/backend/convex/_generated/api";
import {
  createConvexTestWithBetterAuth,
  type seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";
import { evaluateTryoutResponse } from "@repo/backend/convex/tryouts/response/evaluation";
import type { TryoutResponseSpec } from "@repo/backend/convex/tryouts/response/model";
import { seedTryoutContentAccessState } from "@repo/backend/test/tryout/runtime";
import { TRYOUT_TEST_NOW } from "@repo/backend/test/tryouts";
import { Effect } from "effect";

type SeededUser = Awaited<ReturnType<typeof seedAuthenticatedUser>>;

const singleChoice = {
  kind: "single-choice",
  options: [
    {
      isCorrect: true,
      label: "A",
      optionKey: "option-1",
      order: 1,
    },
    {
      isCorrect: false,
      label: "B",
      optionKey: "option-2",
      order: 2,
    },
  ],
} satisfies TryoutResponseSpec;

const multipleChoice = {
  kind: "multiple-choice",
  options: [
    singleChoice.options[0],
    { ...singleChoice.options[1], isCorrect: true },
    {
      isCorrect: false,
      label: "C",
      optionKey: "option-3",
      order: 3,
    },
  ],
} satisfies TryoutResponseSpec;

const category = {
  categories: [
    {
      categoryKey: "category-1",
      label: "Benar",
      order: 1,
    },
    {
      categoryKey: "category-2",
      label: "Salah",
      order: 2,
    },
  ],
  kind: "category",
  statements: [
    {
      correctCategoryKey: "category-1",
      label: "Pernyataan 1",
      order: 1,
      statementKey: "statement-1",
    },
    {
      correctCategoryKey: "category-2",
      label: "Pernyataan 2",
      order: 2,
      statementKey: "statement-2",
    },
  ],
} satisfies TryoutResponseSpec;

describe("try-out response evaluation", () => {
  it.effect("evaluates one single choice and rejects an unknown option", () =>
    Effect.gen(function* () {
      expect(
        yield* evaluateTryoutResponse(singleChoice, {
          kind: "single-choice",
          optionKey: "option-1",
        })
      ).toEqual({
        isComplete: true,
        isCorrect: true,
        selection: { kind: "single-choice", optionKey: "option-1" },
      });

      const error = yield* evaluateTryoutResponse(singleChoice, {
        kind: "single-choice",
        optionKey: "missing",
      }).pipe(Effect.flip);
      expect(error.code).toBe("TRYOUT_RESPONSE_SELECTION_INVALID");
    })
  );

  it.effect("scores an exact multiple-choice set in canonical order", () =>
    Effect.gen(function* () {
      expect(
        yield* evaluateTryoutResponse(multipleChoice, {
          kind: "multiple-choice",
          optionKeys: ["option-2", "option-1"],
        })
      ).toEqual({
        isComplete: true,
        isCorrect: true,
        selection: {
          kind: "multiple-choice",
          optionKeys: ["option-1", "option-2"],
        },
      });
      expect(
        (yield* evaluateTryoutResponse(multipleChoice, {
          kind: "multiple-choice",
          optionKeys: ["option-1"],
        })).isCorrect
      ).toBe(false);

      for (const optionKeys of [[], ["option-1", "option-1"], ["missing"]]) {
        const error = yield* evaluateTryoutResponse(multipleChoice, {
          kind: "multiple-choice",
          optionKeys,
        }).pipe(Effect.flip);
        expect(error.code).toBe("TRYOUT_RESPONSE_SELECTION_INVALID");
      }
    })
  );

  it.effect(
    "keeps category work partial until every statement is assigned",
    () =>
      Effect.gen(function* () {
        expect(
          yield* evaluateTryoutResponse(category, {
            assignments: [
              { categoryKey: "category-1", statementKey: "statement-1" },
            ],
            kind: "category",
          })
        ).toMatchObject({ isComplete: false, isCorrect: false });

        expect(
          yield* evaluateTryoutResponse(category, {
            assignments: [
              { categoryKey: "category-2", statementKey: "statement-2" },
              { categoryKey: "category-1", statementKey: "statement-1" },
            ],
            kind: "category",
          })
        ).toEqual({
          isComplete: true,
          isCorrect: true,
          selection: {
            assignments: [
              { categoryKey: "category-1", statementKey: "statement-1" },
              { categoryKey: "category-2", statementKey: "statement-2" },
            ],
            kind: "category",
          },
        });

        for (const assignments of [
          [],
          [
            { categoryKey: "category-1", statementKey: "statement-1" },
            { categoryKey: "category-2", statementKey: "statement-1" },
          ],
          [{ categoryKey: "missing", statementKey: "statement-1" }],
        ]) {
          const error = yield* evaluateTryoutResponse(category, {
            assignments,
            kind: "category",
          }).pipe(Effect.flip);
          expect(error.code).toBe("TRYOUT_RESPONSE_SELECTION_INVALID");
        }
      })
  );

  it.effect("rejects a selection for a different response kind", () =>
    Effect.gen(function* () {
      for (const selection of [
        { kind: "multiple-choice" as const, optionKeys: ["option-1"] },
        {
          assignments: [
            { categoryKey: "category-1", statementKey: "statement-1" },
          ],
          kind: "category" as const,
        },
      ]) {
        const error = yield* evaluateTryoutResponse(
          singleChoice,
          selection
        ).pipe(Effect.flip);
        expect(error.code).toBe("TRYOUT_RESPONSE_KIND_MISMATCH");
      }
      const error = yield* evaluateTryoutResponse(multipleChoice, {
        kind: "single-choice",
        optionKey: "option-1",
      }).pipe(Effect.flip);
      expect(error.code).toBe("TRYOUT_RESPONSE_KIND_MISMATCH");
    })
  );
});

describe("try-out response persistence", () => {
  it("persists exact multiple selections and clears their counters", async () => {
    const fixture = await seedResponseSpec("multiple", multipleChoice);
    const authed = authenticate(fixture.t, fixture.identity);
    vi.setSystemTime(new Date(TRYOUT_TEST_NOW + 5000));

    await authed.mutation(api.tryouts.mutations.responses.save, {
      placementId: fixture.placementId,
      selection: {
        kind: "multiple-choice",
        optionKeys: ["option-2", "option-1"],
      },
    });
    expect(await readResponseState(fixture)).toMatchObject({
      response: {
        isComplete: true,
        isCorrect: true,
        selection: {
          kind: "multiple-choice",
          optionKeys: ["option-1", "option-2"],
        },
      },
      section: { answeredCount: 1, correctAnswers: 1 },
    });

    vi.setSystemTime(new Date(TRYOUT_TEST_NOW + 9000));
    await authed.mutation(api.tryouts.mutations.responses.save, {
      placementId: fixture.placementId,
      selection: null,
    });
    expect(await readResponseState(fixture)).toMatchObject({
      response: null,
      section: {
        answeredCount: 0,
        correctAnswers: 0,
        lastActivityAt: TRYOUT_TEST_NOW + 9000,
      },
    });
  });

  it("counts a category response only after every statement is assigned", async () => {
    const fixture = await seedResponseSpec("category", category);
    const authed = authenticate(fixture.t, fixture.identity);
    vi.setSystemTime(new Date(TRYOUT_TEST_NOW + 5000));

    await authed.mutation(api.tryouts.mutations.responses.save, {
      placementId: fixture.placementId,
      selection: {
        assignments: [
          { categoryKey: "category-1", statementKey: "statement-1" },
        ],
        kind: "category",
      },
    });
    expect(await readResponseState(fixture)).toMatchObject({
      response: { isComplete: false, isCorrect: false },
      section: { answeredCount: 0, correctAnswers: 0 },
    });

    await authed.mutation(api.tryouts.mutations.responses.save, {
      placementId: fixture.placementId,
      selection: {
        assignments: [
          { categoryKey: "category-2", statementKey: "statement-2" },
          { categoryKey: "category-1", statementKey: "statement-1" },
        ],
        kind: "category",
      },
    });
    expect(await readResponseState(fixture)).toMatchObject({
      response: {
        isComplete: true,
        isCorrect: true,
        selection: {
          assignments: [
            { categoryKey: "category-1", statementKey: "statement-1" },
            { categoryKey: "category-2", statementKey: "statement-2" },
          ],
          kind: "category",
        },
      },
      section: { answeredCount: 1, correctAnswers: 1 },
    });

    await authed.mutation(api.tryouts.mutations.responses.save, {
      placementId: fixture.placementId,
      selection: {
        assignments: [
          { categoryKey: "category-2", statementKey: "statement-1" },
          { categoryKey: "category-2", statementKey: "statement-2" },
        ],
        kind: "category",
      },
    });
    expect(await readResponseState(fixture)).toMatchObject({
      response: { isComplete: true, isCorrect: false },
      section: { answeredCount: 1, correctAnswers: 0 },
    });
  });

  it("rejects a learner selection from another response kind", async () => {
    const fixture = await seedResponseSpec("kind-mismatch", multipleChoice);
    const authed = authenticate(fixture.t, fixture.identity);
    vi.setSystemTime(new Date(TRYOUT_TEST_NOW + 5000));

    await expect(
      authed.mutation(api.tryouts.mutations.responses.save, {
        placementId: fixture.placementId,
        selection: { kind: "single-choice", optionKey: "option-1" },
      })
    ).rejects.toMatchObject({
      data: { code: "TRYOUT_RESPONSE_KIND_MISMATCH" },
    });
  });

  it("requires exactly one expand-contract selection argument", async () => {
    const fixture = await seedResponseSpec("argument", multipleChoice);
    const authed = authenticate(fixture.t, fixture.identity);
    vi.setSystemTime(new Date(TRYOUT_TEST_NOW + 5000));

    for (const args of [
      { placementId: fixture.placementId },
      {
        placementId: fixture.placementId,
        selectedOptionId: "option-1",
        selection: {
          kind: "multiple-choice" as const,
          optionKeys: ["option-1"],
        },
      },
    ]) {
      await expect(
        authed.mutation(api.tryouts.mutations.responses.save, args)
      ).rejects.toMatchObject({
        data: { code: "TRYOUT_RESPONSE_ARGUMENT_INVALID" },
      });
    }
  });
});

/** Seeds one canonical response definition for persistence integration. */
async function seedResponseSpec(
  suffix: string,
  responseSpec: TryoutResponseSpec
) {
  const t = createConvexTestWithBetterAuth();
  const seeded = await t.mutation(async (ctx) => {
    const state = await seedTryoutContentAccessState(ctx, {
      attemptStatus: "in-progress",
      sectionStatus: "in-progress",
      suffix: `response-format-${suffix}`,
    });
    await ctx.db.patch(state.placementId, {
      choiceSnapshots: undefined,
      responseSpec,
    });
    return state;
  });
  return { t, ...seeded };
}

/** Authenticates the learner who owns one seeded attempt. */
function authenticate(
  t: ReturnType<typeof createConvexTestWithBetterAuth>,
  identity: SeededUser
) {
  return t.withIdentity({
    sessionId: identity.sessionId,
    subject: identity.authUserId,
  });
}

/** Reads the persisted learner response and its section counters. */
async function readResponseState(
  fixture: Awaited<ReturnType<typeof seedResponseSpec>>
) {
  return await fixture.t.query(async (ctx) => ({
    response: await ctx.db
      .query("tryoutResponses")
      .withIndex("by_placementId", (index) =>
        index.eq("placementId", fixture.placementId)
      )
      .unique(),
    section: await ctx.db.get(fixture.sectionAttemptId),
  }));
}
