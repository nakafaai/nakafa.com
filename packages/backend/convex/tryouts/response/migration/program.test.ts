import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { TRYOUT_ATTEMPT_PLACEMENT_DOCUMENT_LIMIT } from "@repo/backend/convex/contentRelease/tryout/limits";
import { createConvexTestWithBetterAuth } from "@repo/backend/convex/test.helpers";
import {
  seedInvalidResponseMigration,
  seedResponseMigrationFixture,
} from "@repo/backend/test/tryout/migration";
import { type DefaultFunctionArgs, makeFunctionReference } from "convex/server";
import { Effect } from "effect";

const start = makeFunctionReference<"mutation", Record<string, never>, null>(
  "tryouts/response/migrate:start"
);
interface MigrationPageArgs extends DefaultFunctionArgs {
  cursor: string | null;
  mode: "contract" | "hydrate";
  phase: "placements" | "responses";
}
const page = makeFunctionReference<"mutation", MigrationPageArgs, null>(
  "tryouts/response/migrate:page"
);
const migrationFailure = {
  data: { code: "TRYOUT_RESPONSE_MIGRATION_INVALID" },
};
type ConvexTest = ReturnType<typeof createConvexTestWithBetterAuth>;

describe("tryouts/response/migration/program", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it.effect(
    "rejects a placement whose predecessor and replacement differ",
    () =>
      Effect.gen(function* () {
        const t = createConvexTestWithBetterAuth();
        yield* seedResponseMigrationFixture(t, 1);
        yield* Effect.promise(() =>
          t.mutation(async (ctx) => {
            const placements = await ctx.db
              .query("tryoutAttemptPlacements")
              .collect();
            const placement = placements.find(
              ({ choiceSnapshots, responseSpec }) =>
                choiceSnapshots !== undefined &&
                responseSpec?.kind === "single-choice"
            );
            if (placement?.responseSpec?.kind !== "single-choice") {
              throw new Error("Expected one dual-written placement fixture.");
            }
            const [first, ...remaining] = placement.responseSpec.options;
            if (!first) {
              throw new Error("Expected one response option.");
            }
            await ctx.db.patch(placement._id, {
              responseSpec: {
                ...placement.responseSpec,
                options: [
                  { ...first, label: `${first.label} changed` },
                  ...remaining,
                ],
              },
            });
          })
        );

        yield* expectMigrationFailure(() =>
          t.mutation(page, {
            cursor: null,
            mode: "hydrate",
            phase: "placements",
          })
        );
      })
  );

  it.effect(
    "rejects a historical placement that hydration would oversize",
    () =>
      Effect.gen(function* () {
        const t = createConvexTestWithBetterAuth();
        yield* seedResponseMigrationFixture(t, 1);
        const placementId = yield* Effect.promise(() =>
          t.mutation(async (ctx) => {
            const placements = await ctx.db
              .query("tryoutAttemptPlacements")
              .collect();
            const placement = placements.find(
              ({ choiceSnapshots, responseSpec }) =>
                choiceSnapshots !== undefined && responseSpec === undefined
            );
            const [firstChoice, ...remainingChoices] =
              placement?.choiceSnapshots ?? [];
            if (!(placement && firstChoice)) {
              throw new Error("Expected one historical placement fixture.");
            }
            await ctx.db.patch(placement._id, {
              choiceSnapshots: [
                {
                  ...firstChoice,
                  label: "x".repeat(TRYOUT_ATTEMPT_PLACEMENT_DOCUMENT_LIMIT),
                },
                ...remainingChoices,
              ],
            });
            return placement._id;
          })
        );

        yield* expectMigrationFailure(() =>
          t.mutation(page, {
            cursor: null,
            mode: "hydrate",
            phase: "placements",
          })
        );
        const unchanged = yield* Effect.promise(() =>
          t.run((ctx) => ctx.db.get(placementId))
        );
        expect(unchanged?.responseSpec).toBeUndefined();
      })
  );

  it.effect("rejects a response whose predecessor and replacement differ", () =>
    Effect.gen(function* () {
      const t = createConvexTestWithBetterAuth();
      yield* seedResponseMigrationFixture(t, 1);
      yield* hydrate(t);
      yield* Effect.promise(() =>
        t.mutation(async (ctx) => {
          const responses = await ctx.db.query("tryoutResponses").collect();
          const response = responses.find(
            ({ selectedOptionId, selection }) =>
              selectedOptionId !== undefined &&
              selection?.kind === "single-choice"
          );
          if (!response) {
            throw new Error("Expected one dual-written response fixture.");
          }
          await ctx.db.patch(response._id, {
            selection: { kind: "single-choice", optionKey: "option-2" },
          });
        })
      );

      yield* expectMigrationFailure(() =>
        t.mutation(page, {
          cursor: null,
          mode: "contract",
          phase: "responses",
        })
      );
    })
  );

  it.effect("refuses contraction when the canonical score is stale", () =>
    Effect.gen(function* () {
      const t = createConvexTestWithBetterAuth();
      yield* seedResponseMigrationFixture(t, 1);
      yield* hydrate(t);
      const responseId = yield* Effect.promise(() =>
        t.mutation(async (ctx) => {
          const responses = await ctx.db.query("tryoutResponses").collect();
          const response = responses.find(
            ({ selectedOptionId }) => selectedOptionId !== undefined
          );
          if (!response) {
            throw new Error("Expected one hydrated predecessor response.");
          }
          await ctx.db.patch(response._id, { isCorrect: !response.isCorrect });
          return response._id;
        })
      );

      yield* expectMigrationFailure(() =>
        t.mutation(page, {
          cursor: null,
          mode: "contract",
          phase: "responses",
        })
      );
      const unchanged = yield* Effect.promise(() =>
        t.run((ctx) => ctx.db.get(responseId))
      );
      expect(unchanged?.selectedOptionId).toBeDefined();
    })
  );

  it.effect("rejects a selection outside its frozen response", () =>
    Effect.gen(function* () {
      const t = createConvexTestWithBetterAuth();
      yield* seedInvalidResponseMigration(t, "selection", () => ({
        isCorrect: false,
        selectedOptionId: "missing-option",
      }));

      yield* expectMigrationFailure(() =>
        t.mutation(page, {
          cursor: null,
          mode: "hydrate",
          phase: "responses",
        })
      );
    })
  );

  it.effect("rejects a response whose placement no longer exists", () =>
    Effect.gen(function* () {
      const t = createConvexTestWithBetterAuth();
      yield* seedInvalidResponseMigration(t, "placement", ({ selected }) => ({
        deletePlacement: true,
        isCorrect: selected.isCorrect,
        selectedOptionId: selected.optionKey,
      }));

      yield* expectMigrationFailure(() =>
        t.mutation(page, {
          cursor: null,
          mode: "hydrate",
          phase: "responses",
        })
      );
    })
  );

  it.effect("rejects a canonical response linked to another attempt", () =>
    Effect.gen(function* () {
      const t = createConvexTestWithBetterAuth();
      yield* seedResponseMigrationFixture(t, 1);
      yield* hydrate(t);
      yield* Effect.promise(() =>
        t.mutation(async (ctx) => {
          const response = await ctx.db.query("tryoutResponses").first();
          if (!response) {
            throw new Error("Expected one response to cross-link.");
          }
          const attempt = await ctx.db.get(response.tryoutAttemptId);
          if (!attempt) {
            throw new Error("Expected the response attempt fixture.");
          }
          const { _creationTime, _id, ...attemptFields } = attempt;
          const otherAttemptId = await ctx.db.insert("tryoutAttempts", {
            ...attemptFields,
            attemptNumber: attempt.attemptNumber + 1,
          });
          await ctx.db.patch(response._id, { tryoutAttemptId: otherAttemptId });
        })
      );

      yield* expectMigrationFailure(() =>
        t.mutation(page, {
          cursor: null,
          mode: "contract",
          phase: "responses",
        })
      );
    })
  );

  it.effect("rejects a canonical response linked to another section", () =>
    Effect.gen(function* () {
      const t = createConvexTestWithBetterAuth();
      yield* seedResponseMigrationFixture(t, 1);
      yield* hydrate(t);
      yield* Effect.promise(() =>
        t.mutation(async (ctx) => {
          const response = await ctx.db.query("tryoutResponses").first();
          if (!response) {
            throw new Error("Expected one response to cross-link.");
          }
          const section = await ctx.db.get(response.tryoutSectionAttemptId);
          if (!section) {
            throw new Error("Expected the response section fixture.");
          }
          const { _creationTime, _id, ...sectionFields } = section;
          const otherSectionAttemptId = await ctx.db.insert(
            "tryoutSectionAttempts",
            {
              ...sectionFields,
              sectionIdentity: `${section.sectionIdentity}:other`,
              sectionKey: "other-section",
            }
          );
          await ctx.db.patch(response._id, {
            tryoutSectionAttemptId: otherSectionAttemptId,
          });
        })
      );

      yield* expectMigrationFailure(() =>
        t.mutation(page, {
          cursor: null,
          mode: "contract",
          phase: "responses",
        })
      );
    })
  );

  it.effect("rejects a response with no supported learner selection", () =>
    Effect.gen(function* () {
      const t = createConvexTestWithBetterAuth();
      yield* seedInvalidResponseMigration(t, "empty", ({ selected }) => ({
        isCorrect: selected.isCorrect,
      }));

      yield* expectMigrationFailure(() =>
        t.mutation(page, {
          cursor: null,
          mode: "hydrate",
          phase: "responses",
        })
      );
    })
  );
});

/** Runs the complete bounded hydration chain for one fixture. */
const hydrate = Effect.fn("test.tryout.responseMigration.hydrate")(function* (
  t: ConvexTest
) {
  yield* Effect.promise(() => t.mutation(start, {}));
  yield* Effect.promise(() => t.finishAllScheduledFunctions(vi.runAllTimers));
});

/** Asserts the typed Effect boundary for a rejected migration page. */
const expectMigrationFailure = Effect.fn(
  "test.tryout.responseMigration.program.expectFailure"
)(function* (operation: () => Promise<unknown>) {
  const failure = yield* Effect.tryPromise(operation).pipe(Effect.flip);
  expect(failure.cause).toMatchObject(migrationFailure);
});
