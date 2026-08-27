import { describe, expect, it } from "@effect/vitest";
import { abandonPredecessorObservation } from "@repo/backend/convex/contentRelease/predecessor/control";
import { recordPredecessorRead } from "@repo/backend/convex/contentRelease/predecessor/record";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  COMPETING_PREDECESSOR_OBSERVATION_ID,
  PREDECESSOR_OBSERVATION_ID,
  readPredecessorRows,
  seedPredecessorObservation,
} from "@repo/backend/test/predecessor";
import { convexTest } from "convex-test";

describe("contentRelease/predecessor/rows", () => {
  it("fails closed for partial and competing row state", async () => {
    const partial = convexTest(schema, convexModules);
    await seedPredecessorObservation(partial);
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
        runConvexProgram(
          abandonPredecessorObservation(ctx, PREDECESSOR_OBSERVATION_ID)
        )
      )
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_STATE" } });
    await expect(readPredecessorRows(partial)).resolves.toMatchObject({
      singular: { observationId: PREDECESSOR_OBSERVATION_ID },
    });

    const competing = convexTest(schema, convexModules);
    await seedPredecessorObservation(competing);
    await competing.mutation(async (ctx) => {
      const batch = await ctx.db
        .query("contentPredecessorReads")
        .withIndex("by_route", (query) => query.eq("route", "batch"))
        .unique();
      if (!batch) {
        throw new Error("Expected the batch observation row.");
      }
      await ctx.db.patch("contentPredecessorReads", batch._id, {
        observationId: COMPETING_PREDECESSOR_OBSERVATION_ID,
      });
    });
    await expect(
      competing.mutation((ctx) =>
        runConvexProgram(recordPredecessorRead(ctx, "singular"))
      )
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_INTEGRITY" } });
    await expect(
      competing.mutation((ctx) =>
        runConvexProgram(
          abandonPredecessorObservation(ctx, PREDECESSOR_OBSERVATION_ID)
        )
      )
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_INTEGRITY" } });
    await expect(readPredecessorRows(competing)).resolves.toMatchObject({
      batch: { observationId: COMPETING_PREDECESSOR_OBSERVATION_ID },
      singular: { observationId: PREDECESSOR_OBSERVATION_ID },
    });
  });

  it("rejects duplicate route rows", async () => {
    const target = convexTest(schema, convexModules);
    await seedPredecessorObservation(target);
    await target.mutation(async (ctx) => {
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
      target.mutation((ctx) =>
        runConvexProgram(recordPredecessorRead(ctx, "singular"))
      )
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_INTEGRITY" } });
  });

  it("rejects a conflicting deployed pair instead of expanding it", async () => {
    const target = convexTest(schema, convexModules);
    await seedPredecessorObservation(target);
    await target.mutation(async (ctx) => {
      const rows = await ctx.db.query("contentPredecessorReads").collect();
      for (const row of rows) {
        if (row.route === "protected" || row.route === "history") {
          await ctx.db.delete("contentPredecessorReads", row._id);
        }
        if (row.route === "batch") {
          await ctx.db.patch("contentPredecessorReads", row._id, {
            observationId: COMPETING_PREDECESSOR_OBSERVATION_ID,
          });
        }
      }
    });

    await expect(
      target.mutation((ctx) =>
        runConvexProgram(recordPredecessorRead(ctx, "singular"))
      )
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_INTEGRITY" } });
  });
});
