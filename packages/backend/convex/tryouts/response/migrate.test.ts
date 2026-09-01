import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { createConvexTestWithBetterAuth } from "@repo/backend/convex/test.helpers";
import {
  readResponseMigrationState,
  seedInvalidResponseMigration,
  seedResponseMigrationFixture,
} from "@repo/backend/test/tryout/migration";
import { seedTryoutContentAccessState } from "@repo/backend/test/tryout/runtime";
import { type DefaultFunctionArgs, makeFunctionReference } from "convex/server";
import { Effect } from "effect";

const start = makeFunctionReference<"mutation", Record<string, never>, null>(
  "tryouts/response/migrate:start"
);
const contract = makeFunctionReference<"mutation", Record<string, never>, null>(
  "tryouts/response/migrate:contract"
);
interface MigrationPageArgs extends DefaultFunctionArgs {
  cursor: string | null;
  mode: "contract" | "hydrate";
  phase: "placements" | "responses";
}
const page = makeFunctionReference<"mutation", MigrationPageArgs, null>(
  "tryouts/response/migrate:page"
);

describe("tryouts/response/migrate", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it.effect("hydrates multiple pages without deleting predecessor fields", () =>
    Effect.gen(function* () {
      const t = createConvexTestWithBetterAuth();
      const fixture = yield* seedResponseMigrationFixture(t, 51);

      yield* Effect.promise(() => t.mutation(start, {}));
      yield* Effect.promise(() =>
        t.finishAllScheduledFunctions(vi.runAllTimers)
      );

      const migrated = yield* readResponseMigrationState(t);
      expect(migrated.placements).toHaveLength(52);
      expect(
        migrated.placements.every(
          ({ choiceSnapshots, responseSpec }) =>
            choiceSnapshots !== undefined && responseSpec !== undefined
        )
      ).toBe(true);
      expect(migrated.responses).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            isComplete: true,
            isCorrect: fixture.selected.isCorrect,
            selectedOptionId: fixture.selected.optionKey,
            selection: {
              kind: "single-choice",
              optionKey: fixture.selected.optionKey,
            },
          }),
          expect.objectContaining({
            isComplete: true,
            selection: {
              kind: "single-choice",
              optionKey: fixture.selected.optionKey,
            },
          }),
        ])
      );
      expect(
        migrated.jobs
          .filter(({ name }) => name === "tryouts/response/migrate:page")
          .every(({ state }) => state.kind === "success")
      ).toBe(true);

      yield* Effect.promise(() => t.mutation(start, {}));
      yield* Effect.promise(() =>
        t.finishAllScheduledFunctions(vi.runAllTimers)
      );
      const repeated = yield* readResponseMigrationState(t);
      expect(repeated.placements).toEqual(migrated.placements);
      expect(repeated.responses).toEqual(migrated.responses);
    })
  );

  it.effect("contracts multiple pages idempotently after canonical proof", () =>
    Effect.gen(function* () {
      const t = createConvexTestWithBetterAuth();
      yield* seedResponseMigrationFixture(t, 51);
      yield* Effect.promise(() => t.mutation(start, {}));
      yield* Effect.promise(() =>
        t.finishAllScheduledFunctions(vi.runAllTimers)
      );

      yield* Effect.promise(() => t.mutation(contract, {}));
      yield* Effect.promise(() =>
        t.finishAllScheduledFunctions(vi.runAllTimers)
      );

      const contracted = yield* readResponseMigrationState(t);
      expect(contracted.placements).toHaveLength(52);
      expect(
        contracted.placements.every(
          ({ choiceSnapshots, responseSpec }) =>
            choiceSnapshots === undefined && responseSpec !== undefined
        )
      ).toBe(true);
      expect(
        contracted.responses.every(
          ({ isComplete, selectedOptionId, selection }) =>
            isComplete !== undefined &&
            selectedOptionId === undefined &&
            selection !== undefined
        )
      ).toBe(true);

      yield* Effect.promise(() => t.mutation(contract, {}));
      yield* Effect.promise(() =>
        t.finishAllScheduledFunctions(vi.runAllTimers)
      );
      const repeated = yield* readResponseMigrationState(t);
      expect(repeated.placements).toEqual(contracted.placements);
      expect(repeated.responses).toEqual(contracted.responses);
    })
  );

  it.effect("refuses placement contraction before canonical hydration", () =>
    Effect.gen(function* () {
      const t = createConvexTestWithBetterAuth();
      const seeded = yield* Effect.promise(() =>
        t.mutation((ctx) =>
          seedTryoutContentAccessState(ctx, {
            attemptStatus: "in-progress",
            responseContract: "legacy",
            sectionStatus: "in-progress",
            suffix: "response-contract-placement",
          })
        )
      );

      yield* expectMigrationFailure(() =>
        t.mutation(page, {
          cursor: null,
          mode: "contract",
          phase: "placements",
        })
      );
      const placement = yield* Effect.promise(() =>
        t.run((ctx) => ctx.db.get(seeded.placementId))
      );
      expect(placement?.choiceSnapshots).toBeDefined();
      expect(placement?.responseSpec).toBeUndefined();
    })
  );

  it.effect("refuses response contraction before canonical hydration", () =>
    Effect.gen(function* () {
      const t = createConvexTestWithBetterAuth();
      yield* seedInvalidResponseMigration(
        t,
        "contract-response",
        ({ selected }) => ({
          isCorrect: selected.isCorrect,
          selectedOptionId: selected.optionKey,
        })
      );

      yield* expectMigrationFailure(() =>
        t.mutation(page, {
          cursor: null,
          mode: "contract",
          phase: "responses",
        })
      );
      const response = yield* Effect.promise(() =>
        t.run((ctx) => ctx.db.query("tryoutResponses").unique())
      );
      expect(response?.selectedOptionId).toBeDefined();
      expect(response?.selection).toBeUndefined();
    })
  );
});

/** Asserts the typed Effect boundary for a rejected Convex migration call. */
const expectMigrationFailure = Effect.fn(
  "test.tryout.responseMigration.expectFailure"
)(function* (operation: () => Promise<unknown>) {
  const failure = yield* Effect.tryPromise(operation).pipe(Effect.flip);
  expect(failure.cause).toMatchObject({
    data: { code: "TRYOUT_RESPONSE_MIGRATION_INVALID" },
  });
});
