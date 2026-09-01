import { internalMutation } from "@repo/backend/convex/functions";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import {
  migratePage,
  schedulePage,
} from "@repo/backend/convex/tryouts/response/migration/program";
import { v } from "convex/values";

/** Starts the bounded placement then response hydration chain. */
export const start = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    await runConvexProgram(schedulePage(ctx, "hydrate", "placements", null));
    return null;
  },
});

/** Starts predecessor deletion after canonical rollout proof. */
export const contract = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    await runConvexProgram(schedulePage(ctx, "contract", "placements", null));
    return null;
  },
});

/** Migrates one bounded page and schedules the next phase when necessary. */
export const page = internalMutation({
  args: {
    cursor: v.union(v.string(), v.null()),
    mode: v.union(v.literal("contract"), v.literal("hydrate")),
    phase: v.union(v.literal("placements"), v.literal("responses")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await runConvexProgram(migratePage(ctx, args));
    return null;
  },
});
