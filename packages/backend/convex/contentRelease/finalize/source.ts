import { internalQuery } from "@repo/backend/convex/_generated/server";
import { loadFinalizationSource } from "@repo/backend/convex/contentRelease/finalize/source/impl";
import { finalizationSourceValidator } from "@repo/backend/convex/contentRelease/finalize/spec";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";

/** Internal source boundary for Node-authenticated finalization. */
export const source = internalQuery({
  args: {},
  returns: finalizationSourceValidator,
  handler: (ctx) => runConvexProgram(loadFinalizationSource(ctx)),
});
