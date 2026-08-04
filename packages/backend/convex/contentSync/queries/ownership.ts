import { internalQuery } from "@repo/backend/convex/_generated/server";
import { loadTryoutSyncOwnership } from "@repo/backend/convex/contentSync/tryouts/source";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { v } from "convex/values";

const contentSyncOwnershipValidator = v.object({
  tryoutsManaged: v.boolean(),
});

/** Returns the authoritative source owner for each transitional sync scope. */
export const read = internalQuery({
  args: {},
  returns: contentSyncOwnershipValidator,
  handler: (ctx) => runConvexProgram(loadTryoutSyncOwnership(ctx)),
});
