import {
  armPredecessorObservation,
  clearPredecessorObservation,
  readPredecessorObservation,
  recordPredecessorRead,
  sealPredecessorObservation,
} from "@repo/backend/convex/contentRelease/predecessor/model";
import {
  PREDECESSOR_QUIET_WINDOW_MS,
  PREDECESSOR_ROUTES,
} from "@repo/backend/convex/contentRelease/predecessor/spec";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { insertRuntimeRelease } from "@repo/backend/test/content-runtime";
import { TEST_RUNTIME_RELEASE } from "@repo/backend/test/runtime-values";
import { convexTest, type TestConvex } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const OBSERVATION_ID = "dates-cutover-4974ee8c";
type Target = TestConvex<typeof schema>;

/** Seeds one active release and atomically arms both predecessor routes. */
async function seedAndArm(target: Target) {
  await target.mutation((ctx) => insertRuntimeRelease(ctx));
  return await target.mutation((ctx) =>
    runConvexProgram(armPredecessorObservation(ctx, OBSERVATION_ID))
  );
}

/** Reads the two bounded observation rows in route order. */
function readRows(target: Target) {
  return target.run(async (ctx) => ({
    batch: await ctx.db
      .query("contentPredecessorReads")
      .withIndex("by_route", (query) => query.eq("route", "batch"))
      .unique(),
    singular: await ctx.db
      .query("contentPredecessorReads")
      .withIndex("by_route", (query) => query.eq("route", "singular"))
      .unique(),
  }));
}

/** Patches every existing observer row inside one test-only transaction. */
function patchRows(
  target: Target,
  patch: {
    readonly deploymentName?: string;
  }
) {
  return target.mutation(async (ctx) => {
    const rows = await ctx.db.query("contentPredecessorReads").collect();
    for (const row of rows) {
      await ctx.db.patch("contentPredecessorReads", row._id, patch);
    }
  });
}

describe("contentRelease/predecessor/model", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("rejects arm without one complete active release", async () => {
    const target = convexTest(schema, convexModules);
    await expect(
      target.mutation((ctx) =>
        runConvexProgram(armPredecessorObservation(ctx, OBSERVATION_ID))
      )
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_STATE" } });
  });

  it("is inactive before arm and binds both rows to the exact active release", async () => {
    const target = convexTest(schema, convexModules);
    await expect(
      target.mutation((ctx) =>
        runConvexProgram(recordPredecessorRead(ctx, "singular"))
      )
    ).resolves.toEqual({ kind: "inactive" });

    const armed = await seedAndArm(target);
    expect(armed).toMatchObject({
      active: TEST_RUNTIME_RELEASE,
      deploymentName: "test",
      kind: "active",
      observationId: OBSERVATION_ID,
      routes: {
        batch: { invocationCount: 0, phase: "armed", route: "batch" },
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
    const rowsBeforeReplay = await readRows(target);
    const replay = await target.mutation((ctx) =>
      runConvexProgram(armPredecessorObservation(ctx, OBSERVATION_ID))
    );
    expect(replay).toMatchObject({
      routes: {
        batch: { invocationCount: 0, phase: "armed" },
        singular: { invocationCount: 1, phase: "armed" },
      },
    });
    await expect(readRows(target)).resolves.toEqual(rowsBeforeReplay);
    await expect(
      target.mutation((ctx) =>
        runConvexProgram(
          armPredecessorObservation(ctx, "dates-competing-4974ee8c")
        )
      )
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_STATE" } });
  });

  it("counts concurrent route reads exactly and resets each quiet clock", async () => {
    const target = convexTest(schema, convexModules);
    await seedAndArm(target);
    const routes = Array.from({ length: 32 }, (_, index) =>
      index % 2 === 0 ? ("singular" as const) : ("batch" as const)
    );

    const results = await Promise.all(
      routes.map((route) =>
        target.mutation((ctx) =>
          runConvexProgram(recordPredecessorRead(ctx, route))
        )
      )
    );
    expect(results).toEqual(
      Array.from({ length: routes.length }, () => ({ kind: "recorded" }))
    );

    const status = await target.query((ctx) =>
      runConvexProgram(readPredecessorObservation(ctx, OBSERVATION_ID))
    );
    expect(status.routes.singular.invocationCount).toBe(16);
    expect(status.routes.batch.invocationCount).toBe(16);
    expect(status.routes.singular.quietSince).toBe(
      status.routes.singular.lastInvokedAt
    );
    expect(status.routes.batch.quietSince).toBe(
      status.routes.batch.lastInvokedAt
    );
    expect(status).not.toHaveProperty("readyToSeal");
    expect(status.routes.singular).not.toHaveProperty("quietForMs");
  });

  it("fails closed for partial, competing, and deployment state", async () => {
    const partial = convexTest(schema, convexModules);
    await seedAndArm(partial);
    await partial.mutation(async (ctx) => {
      const batch = await ctx.db
        .query("contentPredecessorReads")
        .withIndex("by_route", (query) => query.eq("route", "batch"))
        .unique();
      if (!batch) {
        throw new Error("Expected the batch observation row.");
      }
      await ctx.db.delete("contentPredecessorReads", batch._id);
    });
    await expect(
      partial.mutation((ctx) =>
        runConvexProgram(recordPredecessorRead(ctx, "singular"))
      )
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_STATE" } });
    await expect(
      partial.mutation((ctx) =>
        runConvexProgram(clearPredecessorObservation(ctx, OBSERVATION_ID))
      )
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_STATE" } });
    await expect(readRows(partial)).resolves.toMatchObject({
      singular: { observationId: OBSERVATION_ID },
    });

    const competing = convexTest(schema, convexModules);
    await seedAndArm(competing);
    await competing.mutation(async (ctx) => {
      const batch = await ctx.db
        .query("contentPredecessorReads")
        .withIndex("by_route", (query) => query.eq("route", "batch"))
        .unique();
      if (!batch) {
        throw new Error("Expected the batch observation row.");
      }
      await ctx.db.patch("contentPredecessorReads", batch._id, {
        observationId: "dates-competing-4974ee8c",
      });
    });
    await expect(
      competing.mutation((ctx) =>
        runConvexProgram(recordPredecessorRead(ctx, "singular"))
      )
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_INTEGRITY" } });
    await expect(
      competing.mutation((ctx) =>
        runConvexProgram(clearPredecessorObservation(ctx, OBSERVATION_ID))
      )
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_INTEGRITY" } });
    await expect(readRows(competing)).resolves.toMatchObject({
      batch: { observationId: "dates-competing-4974ee8c" },
      singular: { observationId: OBSERVATION_ID },
    });

    const deployment = convexTest(schema, convexModules);
    await seedAndArm(deployment);
    await patchRows(deployment, { deploymentName: "other-deployment" });
    await expect(
      deployment.mutation((ctx) =>
        runConvexProgram(recordPredecessorRead(ctx, "batch"))
      )
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_STATE" } });
  });

  it("rejects duplicate route rows and a saturated invocation counter", async () => {
    const duplicate = convexTest(schema, convexModules);
    await seedAndArm(duplicate);
    await duplicate.mutation(async (ctx) => {
      const singular = await ctx.db
        .query("contentPredecessorReads")
        .withIndex("by_route", (query) => query.eq("route", "singular"))
        .unique();
      if (!singular) {
        throw new Error("Expected the singular observation row.");
      }
      await ctx.db.insert("contentPredecessorReads", {
        activeManifestHash: singular.activeManifestHash,
        activeReleaseId: singular.activeReleaseId,
        activeSequence: singular.activeSequence,
        armedAt: singular.armedAt,
        deploymentName: singular.deploymentName,
        invocationCount: singular.invocationCount,
        observationId: singular.observationId,
        phase: singular.phase,
        quietSince: singular.quietSince,
        route: singular.route,
      });
    });
    await expect(
      duplicate.mutation((ctx) =>
        runConvexProgram(recordPredecessorRead(ctx, "singular"))
      )
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_INTEGRITY" } });

    const saturated = convexTest(schema, convexModules);
    await seedAndArm(saturated);
    await saturated.mutation(async (ctx) => {
      const singular = await ctx.db
        .query("contentPredecessorReads")
        .withIndex("by_route", (query) => query.eq("route", "singular"))
        .unique();
      if (!singular) {
        throw new Error("Expected the singular observation row.");
      }
      await ctx.db.patch("contentPredecessorReads", singular._id, {
        invocationCount: Number.MAX_SAFE_INTEGER,
      });
    });
    await expect(
      saturated.mutation((ctx) =>
        runConvexProgram(recordPredecessorRead(ctx, "singular"))
      )
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_INTEGRITY" } });
  });

  it.each(PREDECESSOR_ROUTES)(
    "seals %s at the exact 24-hour boundary",
    async (route) => {
      const target = convexTest(schema, convexModules);
      const armedAt = Date.UTC(2026, 7, 26, 8);
      const invokedAt = armedAt + 1000;
      vi.setSystemTime(armedAt);
      await seedAndArm(target);
      vi.setSystemTime(invokedAt);
      await target.mutation((ctx) =>
        runConvexProgram(recordPredecessorRead(ctx, route))
      );

      vi.setSystemTime(invokedAt + PREDECESSOR_QUIET_WINDOW_MS - 1);
      await expect(
        target.mutation((ctx) =>
          runConvexProgram(sealPredecessorObservation(ctx, OBSERVATION_ID))
        )
      ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_STATE" } });

      vi.setSystemTime(invokedAt + PREDECESSOR_QUIET_WINDOW_MS);
      await expect(
        target.mutation((ctx) =>
          runConvexProgram(sealPredecessorObservation(ctx, OBSERVATION_ID))
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

  it("clears only the exact sealed identity with its durable evidence", async () => {
    const target = convexTest(schema, convexModules);
    const armedAt = Date.UTC(2026, 7, 26, 8);
    vi.setSystemTime(armedAt);
    await seedAndArm(target);
    vi.setSystemTime(armedAt + PREDECESSOR_QUIET_WINDOW_MS);
    const sealed = await target.mutation((ctx) =>
      runConvexProgram(sealPredecessorObservation(ctx, OBSERVATION_ID))
    );
    await expect(
      target.mutation((ctx) =>
        runConvexProgram(armPredecessorObservation(ctx, OBSERVATION_ID))
      )
    ).resolves.toEqual(sealed);
    await expect(
      target.mutation((ctx) =>
        runConvexProgram(sealPredecessorObservation(ctx, OBSERVATION_ID))
      )
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_STATE" } });
    await expect(
      target.mutation((ctx) =>
        runConvexProgram(recordPredecessorRead(ctx, "singular"))
      )
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_STATE" } });
    await expect(
      target.mutation((ctx) =>
        runConvexProgram(
          clearPredecessorObservation(ctx, "dates-competing-4974ee8c")
        )
      )
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_STATE" } });

    const cleared = await target.mutation((ctx) =>
      runConvexProgram(clearPredecessorObservation(ctx, OBSERVATION_ID))
    );
    expect(cleared).toMatchObject({
      active: TEST_RUNTIME_RELEASE,
      clearedAt: armedAt + PREDECESSOR_QUIET_WINDOW_MS,
      deleted: 2,
      deploymentName: "test",
      kind: "cleared",
      observationId: OBSERVATION_ID,
      routes: {
        batch: { invocationCount: 0, phase: "sealed" },
        singular: { invocationCount: 0, phase: "sealed" },
      },
    });
    await expect(readRows(target)).resolves.toEqual({
      batch: null,
      singular: null,
    });
  });

  it("does not clear an observation before both routes are sealed", async () => {
    const target = convexTest(schema, convexModules);
    await seedAndArm(target);
    await expect(
      target.mutation((ctx) =>
        runConvexProgram(clearPredecessorObservation(ctx, OBSERVATION_ID))
      )
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_STATE" } });
    await expect(readRows(target)).resolves.toMatchObject({
      batch: { phase: "armed" },
      singular: { phase: "armed" },
    });
  });
});
