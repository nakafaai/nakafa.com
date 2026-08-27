import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "@effect/vitest";
import {
  abandonPredecessorObservation,
  armPredecessorObservation,
  requireSealedPredecessorObservation,
  sealPredecessorObservation,
} from "@repo/backend/convex/contentRelease/predecessor/control";
import { recordPredecessorRead } from "@repo/backend/convex/contentRelease/predecessor/record";
import {
  PREDECESSOR_QUIET_WINDOW_MS,
  PREDECESSOR_ROUTES,
} from "@repo/backend/convex/contentRelease/predecessor/spec";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  COMPETING_PREDECESSOR_OBSERVATION_ID,
  driftPredecessorRelease,
  PREDECESSOR_OBSERVATION_ID,
  patchPredecessorRows,
  readPredecessorRows,
  seedPredecessorObservation,
} from "@repo/backend/test/predecessor";
import { TEST_RUNTIME_RELEASE } from "@repo/backend/test/runtime/values";
import { convexTest } from "convex-test";

describe("contentRelease/predecessor/control", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("rejects arm without one complete active release", async () => {
    const target = convexTest(schema, convexModules);
    await expect(
      target.mutation((ctx) =>
        runConvexProgram(
          armPredecessorObservation(ctx, PREDECESSOR_OBSERVATION_ID)
        )
      )
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_STATE" } });
  });

  it("binds every route and replays only its exact observation", async () => {
    const target = convexTest(schema, convexModules);
    const armed = await seedPredecessorObservation(target);
    expect(armed).toMatchObject({
      active: TEST_RUNTIME_RELEASE,
      deploymentName: "test",
      kind: "active",
      observationId: PREDECESSOR_OBSERVATION_ID,
      routes: {
        batch: { invocationCount: 0, phase: "armed", route: "batch" },
        history: { invocationCount: 0, phase: "armed", route: "history" },
        protected: {
          invocationCount: 0,
          phase: "armed",
          route: "protected",
        },
        singular: {
          invocationCount: 0,
          phase: "armed",
          route: "singular",
        },
      },
    });
    await target.mutation((ctx) =>
      runConvexProgram(recordPredecessorRead(ctx, "singular"))
    );
    const rowsBeforeReplay = await readPredecessorRows(target);
    const replay = await target.mutation((ctx) =>
      runConvexProgram(
        armPredecessorObservation(ctx, PREDECESSOR_OBSERVATION_ID)
      )
    );
    expect(replay.routes.singular.invocationCount).toBe(1);
    await expect(readPredecessorRows(target)).resolves.toEqual(
      rowsBeforeReplay
    );
    await expect(
      target.mutation((ctx) =>
        runConvexProgram(
          armPredecessorObservation(ctx, COMPETING_PREDECESSOR_OBSERVATION_ID)
        )
      )
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_STATE" } });
  });

  it("expands the deployed pair and starts new route clocks at expansion", async () => {
    const target = convexTest(schema, convexModules);
    const armedAt = Date.UTC(2026, 7, 26, 8);
    const expandedAt = armedAt + 60 * 60 * 1000;
    vi.setSystemTime(armedAt);
    await seedPredecessorObservation(target);
    await target.mutation(async (ctx) => {
      const rows = await ctx.db.query("contentPredecessorReads").collect();
      for (const row of rows) {
        if (row.route === "protected" || row.route === "history") {
          await ctx.db.delete("contentPredecessorReads", row._id);
        }
      }
    });

    vi.setSystemTime(expandedAt);
    const expanded = await target.mutation((ctx) =>
      runConvexProgram(
        armPredecessorObservation(ctx, PREDECESSOR_OBSERVATION_ID)
      )
    );
    expect(expanded.routes).toMatchObject({
      batch: { phase: "armed", quietSince: armedAt },
      history: { phase: "armed", quietSince: expandedAt },
      protected: { phase: "armed", quietSince: expandedAt },
      singular: { phase: "armed", quietSince: armedAt },
    });
    await expect(readPredecessorRows(target)).resolves.toMatchObject({
      batch: { observationId: PREDECESSOR_OBSERVATION_ID },
      history: { observationId: PREDECESSOR_OBSERVATION_ID },
      protected: { observationId: PREDECESSOR_OBSERVATION_ID },
      singular: { observationId: PREDECESSOR_OBSERVATION_ID },
    });

    vi.setSystemTime(armedAt + PREDECESSOR_QUIET_WINDOW_MS);
    await expect(
      target.mutation((ctx) =>
        runConvexProgram(
          sealPredecessorObservation(ctx, PREDECESSOR_OBSERVATION_ID)
        )
      )
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_STATE" } });
  });

  it.each(PREDECESSOR_ROUTES)(
    "seals %s at the exact 24-hour boundary",
    async (route) => {
      const target = convexTest(schema, convexModules);
      const armedAt = Date.UTC(2026, 7, 26, 8);
      const invokedAt = armedAt + 1000;
      vi.setSystemTime(armedAt);
      await seedPredecessorObservation(target);
      vi.setSystemTime(invokedAt);
      await target.mutation((ctx) =>
        runConvexProgram(recordPredecessorRead(ctx, route))
      );

      vi.setSystemTime(invokedAt + PREDECESSOR_QUIET_WINDOW_MS - 1);
      await expect(
        target.mutation((ctx) =>
          runConvexProgram(
            sealPredecessorObservation(ctx, PREDECESSOR_OBSERVATION_ID)
          )
        )
      ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_STATE" } });

      vi.setSystemTime(invokedAt + PREDECESSOR_QUIET_WINDOW_MS);
      await expect(
        target.mutation((ctx) =>
          runConvexProgram(
            sealPredecessorObservation(ctx, PREDECESSOR_OBSERVATION_ID)
          )
        )
      ).resolves.toMatchObject({
        kind: "active",
        routes: {
          [route]: {
            phase: "sealed",
            quietSince: invokedAt,
            sealedAt: invokedAt + PREDECESSOR_QUIET_WINDOW_MS,
          },
        },
      });
    }
  );

  it("retains sealed evidence and exposes it to the migration gate", async () => {
    const target = convexTest(schema, convexModules);
    const armedAt = Date.UTC(2026, 7, 26, 8);
    vi.setSystemTime(armedAt);
    await expect(
      target.query((ctx) =>
        runConvexProgram(requireSealedPredecessorObservation(ctx))
      )
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_STATE" } });

    await seedPredecessorObservation(target);
    await expect(
      target.query((ctx) =>
        runConvexProgram(requireSealedPredecessorObservation(ctx))
      )
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_STATE" } });
    vi.setSystemTime(armedAt + PREDECESSOR_QUIET_WINDOW_MS);
    const sealed = await target.mutation((ctx) =>
      runConvexProgram(
        sealPredecessorObservation(ctx, PREDECESSOR_OBSERVATION_ID)
      )
    );
    await expect(
      target.mutation((ctx) =>
        runConvexProgram(
          armPredecessorObservation(ctx, PREDECESSOR_OBSERVATION_ID)
        )
      )
    ).resolves.toEqual(sealed);
    await expect(
      target.query((ctx) =>
        runConvexProgram(
          requireSealedPredecessorObservation(ctx, PREDECESSOR_OBSERVATION_ID)
        )
      )
    ).resolves.toBe(PREDECESSOR_OBSERVATION_ID);
    await expect(
      target.query((ctx) =>
        runConvexProgram(
          requireSealedPredecessorObservation(
            ctx,
            COMPETING_PREDECESSOR_OBSERVATION_ID
          )
        )
      )
    ).rejects.toMatchObject({
      data: {
        code: "CONTENT_RELEASE_STATE",
        message: "Predecessor observation ID changed during migration.",
      },
    });
    await expect(
      target.mutation((ctx) =>
        runConvexProgram(
          sealPredecessorObservation(ctx, PREDECESSOR_OBSERVATION_ID)
        )
      )
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_STATE" } });
    await expect(
      target.mutation((ctx) =>
        runConvexProgram(
          abandonPredecessorObservation(ctx, PREDECESSOR_OBSERVATION_ID)
        )
      )
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_STATE" } });

    await patchPredecessorRows(target, { deploymentName: "other-deployment" });
    await expect(
      target.query((ctx) =>
        runConvexProgram(requireSealedPredecessorObservation(ctx))
      )
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_STATE" } });
  });

  it("abandons all four rows only after active release drift", async () => {
    const target = convexTest(schema, convexModules);
    await seedPredecessorObservation(target);
    await driftPredecessorRelease(target);

    await expect(
      target.mutation((ctx) =>
        runConvexProgram(recordPredecessorRead(ctx, "protected"))
      )
    ).resolves.toMatchObject({
      kind: "drifted",
      stored: TEST_RUNTIME_RELEASE,
    });
    await expect(
      target.mutation((ctx) =>
        runConvexProgram(
          sealPredecessorObservation(ctx, PREDECESSOR_OBSERVATION_ID)
        )
      )
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_STATE" } });
    await expect(
      target.mutation((ctx) =>
        runConvexProgram(
          abandonPredecessorObservation(ctx, PREDECESSOR_OBSERVATION_ID)
        )
      )
    ).resolves.toMatchObject({
      deleted: 4,
      kind: "abandoned",
      observationId: PREDECESSOR_OBSERVATION_ID,
      stored: TEST_RUNTIME_RELEASE,
    });
    await expect(readPredecessorRows(target)).resolves.toEqual({
      batch: null,
      history: null,
      protected: null,
      singular: null,
    });
  });
});
