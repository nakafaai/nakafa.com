import { internalMutation } from "@repo/backend/convex/_generated/server";
import { beginHistoryRetirement } from "@repo/backend/convex/contentRelease/retire/history";
import { retirementHistoryValidator } from "@repo/backend/convex/contentRelease/retire/spec";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { v } from "convex/values";

/** Temporary compaction admission; remove after obsolete Question projections are absent. */
export const history = internalMutation({
  args: { plan: retirementHistoryValidator },
  returns: v.object({ complete: v.boolean(), floor: v.number() }),
  handler: (ctx, { plan }) =>
    runConvexProgram(beginHistoryRetirement(ctx, plan)),
});
