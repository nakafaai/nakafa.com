import { internalMutation } from "@repo/backend/convex/_generated/server";
import { retireAttemptPage } from "@repo/backend/convex/contentRelease/retire/attempt";
import { beginHistoryRetirement } from "@repo/backend/convex/contentRelease/retire/history";
import {
  retirementAttemptValidator,
  retirementHistoryValidator,
} from "@repo/backend/convex/contentRelease/retire/spec";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { v } from "convex/values";

/** Temporary exact-identity retirement; remove after prod and dev zero proof. */
export const attempt = internalMutation({
  args: { plan: retirementAttemptValidator },
  returns: v.object({ complete: v.boolean() }),
  handler: (ctx, { plan }) => runConvexProgram(retireAttemptPage(ctx, plan)),
});

/** Temporary compaction admission; remove with the predecessor scope decoder. */
export const history = internalMutation({
  args: { plan: retirementHistoryValidator },
  returns: v.object({ complete: v.boolean(), floor: v.number() }),
  handler: (ctx, { plan }) =>
    runConvexProgram(beginHistoryRetirement(ctx, plan)),
});
