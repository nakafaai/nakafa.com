import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { armPredecessorObservation } from "@repo/backend/convex/contentRelease/predecessor/control";
import { PREDECESSOR_QUIET_WINDOW_MS } from "@repo/backend/convex/contentRelease/predecessor/spec";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import type schema from "@repo/backend/convex/schema";
import { insertRuntimeRelease } from "@repo/backend/test/content/runtime";
import type { TestConvex } from "convex-test";

export const PREDECESSOR_OBSERVATION_ID = "test-predecessor-observation";
export const COMPETING_PREDECESSOR_OBSERVATION_ID =
  "test-competing-observation";
export type PredecessorTarget = TestConvex<typeof schema>;

/** Seeds one active release and atomically arms every predecessor route. */
export async function seedPredecessorObservation(target: PredecessorTarget) {
  await target.mutation((ctx) => insertRuntimeRelease(ctx));
  return await target.mutation((ctx) =>
    runConvexProgram(armPredecessorObservation(ctx, PREDECESSOR_OBSERVATION_ID))
  );
}

/** Seeds sealed migration evidence around the fixture's active release. */
export async function seedSealedPredecessorObservation(ctx: MutationCtx) {
  const status = await runConvexProgram(
    armPredecessorObservation(ctx, PREDECESSOR_OBSERVATION_ID)
  );
  const sealedAt =
    Math.max(
      ...Object.values(status.routes).map(({ quietSince }) => quietSince)
    ) + PREDECESSOR_QUIET_WINDOW_MS;
  const rows = await ctx.db.query("contentPredecessorReads").collect();
  for (const row of rows) {
    await ctx.db.patch("contentPredecessorReads", row._id, {
      phase: "sealed",
      sealedAt,
    });
  }
}

/** Reads every bounded observation row in route order. */
export function readPredecessorRows(target: PredecessorTarget) {
  return target.run(async (ctx) => ({
    batch: await ctx.db
      .query("contentPredecessorReads")
      .withIndex("by_route", (query) => query.eq("route", "batch"))
      .unique(),
    history: await ctx.db
      .query("contentPredecessorReads")
      .withIndex("by_route", (query) => query.eq("route", "history"))
      .unique(),
    protected: await ctx.db
      .query("contentPredecessorReads")
      .withIndex("by_route", (query) => query.eq("route", "protected"))
      .unique(),
    singular: await ctx.db
      .query("contentPredecessorReads")
      .withIndex("by_route", (query) => query.eq("route", "singular"))
      .unique(),
  }));
}

/** Patches every existing observer row inside one test-only transaction. */
export function patchPredecessorRows(
  target: PredecessorTarget,
  patch: { readonly deploymentName?: string }
) {
  return target.mutation(async (ctx) => {
    const rows = await ctx.db.query("contentPredecessorReads").collect();
    for (const row of rows) {
      await ctx.db.patch("contentPredecessorReads", row._id, patch);
    }
  });
}

/** Changes the active sequence without mutating the observed row identity. */
export function driftPredecessorRelease(target: PredecessorTarget) {
  return target.mutation(async (ctx) => {
    const state = await ctx.db
      .query("contentState")
      .withIndex("by_key", (query) => query.eq("key", "primary"))
      .unique();
    if (state?.activeSequence === undefined) {
      throw new Error("Expected one active content release state.");
    }
    await ctx.db.patch("contentState", state._id, {
      activeSequence: state.activeSequence + 1,
    });
  });
}
