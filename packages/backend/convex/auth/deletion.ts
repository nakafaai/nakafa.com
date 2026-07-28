import { internalMutation } from "@repo/backend/convex/_generated/server";
import { prepareAccountDeletion as prepareAccountDeletionProgram } from "@repo/backend/convex/auth/deletion/prepare";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { v } from "convex/values";

/** Quiesces the account and preserves every owned school before auth deletion. */
export const prepareAccountDeletion = internalMutation({
  args: {
    authId: v.string(),
  },
  returns: v.boolean(),
  handler: (ctx, args) =>
    runConvexProgram(prepareAccountDeletionProgram(ctx, args.authId)),
});
