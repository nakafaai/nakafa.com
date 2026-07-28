import { internalQuery } from "@repo/backend/convex/_generated/server";
import { getSchoolOwnershipDeletionReadiness } from "@repo/backend/convex/auth/deletion/readiness";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { v } from "convex/values";

/** Reports whether account deletion can preserve every owned school. */
export const getSchoolOwnershipReadiness = internalQuery({
  args: {
    authId: v.string(),
  },
  returns: v.boolean(),
  handler: (ctx, args) =>
    runConvexProgram(getSchoolOwnershipDeletionReadiness(ctx, args.authId)),
});
