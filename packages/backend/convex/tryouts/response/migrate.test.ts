import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { createConvexTestWithBetterAuth } from "@repo/backend/convex/test.helpers";
import {
  readResponseMigrationState,
  seedInvalidResponseMigration,
  seedResponseMigrationFixture,
} from "@repo/backend/test/tryout/migration";
import { seedTryoutContentAccessState } from "@repo/backend/test/tryout/runtime";
import { type DefaultFunctionArgs, makeFunctionReference } from "convex/server";

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

  it("hydrates multiple pages without deleting predecessor fields", async () => {
    const t = createConvexTestWithBetterAuth();
    const fixture = await seedResponseMigrationFixture(t, 51);

    await t.mutation(start, {});
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const migrated = await readResponseMigrationState(t);
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

    await t.mutation(start, {});
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const repeated = await readResponseMigrationState(t);
    expect(repeated.placements).toEqual(migrated.placements);
    expect(repeated.responses).toEqual(migrated.responses);
  });

  it("contracts multiple pages idempotently after canonical proof", async () => {
    const t = createConvexTestWithBetterAuth();
    await seedResponseMigrationFixture(t, 51);
    await t.mutation(start, {});
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    await t.mutation(contract, {});
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const contracted = await readResponseMigrationState(t);
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

    await t.mutation(contract, {});
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const repeated = await readResponseMigrationState(t);
    expect(repeated.placements).toEqual(contracted.placements);
    expect(repeated.responses).toEqual(contracted.responses);
  });

  it("refuses placement contraction before canonical hydration", async () => {
    const t = createConvexTestWithBetterAuth();
    const seeded = await t.mutation((ctx) =>
      seedTryoutContentAccessState(ctx, {
        attemptStatus: "in-progress",
        sectionStatus: "in-progress",
        suffix: "response-contract-placement",
      })
    );

    await expect(
      t.mutation(page, {
        cursor: null,
        mode: "contract",
        phase: "placements",
      })
    ).rejects.toMatchObject({
      data: { code: "TRYOUT_RESPONSE_MIGRATION_INVALID" },
    });
    const placement = await t.run((ctx) => ctx.db.get(seeded.placementId));
    expect(placement?.choiceSnapshots).toBeDefined();
    expect(placement?.responseSpec).toBeUndefined();
  });

  it("refuses response contraction before canonical hydration", async () => {
    const t = createConvexTestWithBetterAuth();
    await seedInvalidResponseMigration(
      t,
      "contract-response",
      ({ selected }) => ({
        isCorrect: selected.isCorrect,
        selectedOptionId: selected.optionKey,
      })
    );

    await expect(
      t.mutation(page, {
        cursor: null,
        mode: "contract",
        phase: "responses",
      })
    ).rejects.toMatchObject({
      data: { code: "TRYOUT_RESPONSE_MIGRATION_INVALID" },
    });
    const response = await t.run((ctx) =>
      ctx.db.query("tryoutResponses").unique()
    );
    expect(response?.selectedOptionId).toBeDefined();
    expect(response?.selection).toBeUndefined();
  });
});
