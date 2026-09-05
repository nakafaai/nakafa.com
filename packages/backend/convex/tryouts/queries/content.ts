import { query } from "@repo/backend/convex/_generated/server";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { tryoutBodyBatchValidator } from "@repo/backend/convex/tryouts/runtime/body";
import { readTryoutHistory } from "@repo/backend/convex/tryouts/runtime/history/read";
import { tryoutHistoryRequestValidator } from "@repo/backend/convex/tryouts/runtime/history/spec";
import { v } from "convex/values";

/** Delivers original signed bodies only to the authenticated attempt owner. */
export const getBatch = query({
  args: tryoutHistoryRequestValidator,
  returns: v.union(v.null(), tryoutBodyBatchValidator),
  handler: (ctx, args) => runConvexProgram(readTryoutHistory(ctx, args)),
});
