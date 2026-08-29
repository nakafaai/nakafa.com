"use node";

import { internalAction } from "@repo/backend/convex/_generated/server";
import { makeFinalizationProgram } from "@repo/backend/convex/contentRelease/finalize/dispatch/impl";
import {
  finalizationDispatchArgsValidator,
  finalizationReceiptValidator,
} from "@repo/backend/convex/contentRelease/finalize/spec";
import { runConvexActionProgram } from "@repo/backend/convex/lib/effect";

/** Node-authenticated boundary for the exact protected genesis asset. */
export const finalize = internalAction({
  args: finalizationDispatchArgsValidator,
  returns: finalizationReceiptValidator,
  handler: (ctx, args) =>
    runConvexActionProgram(makeFinalizationProgram(ctx, args.bundleJson)),
});
