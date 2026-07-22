import { cleanupDeletedUserProgram } from "@repo/backend/convex/auth/cleanup/impl";
import { internalMutation } from "@repo/backend/convex/functions";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { v } from "convex/values";

/** Deletes one user's local app data after the auth account is removed. */
export const cleanupDeletedUser = internalMutation({
  args: {
    userId: v.id("users"),
  },
  returns: v.null(),
  handler: (ctx, args) =>
    runConvexProgram(cleanupDeletedUserProgram(ctx, args.userId)),
});
