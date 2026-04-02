import { internalQuery } from "@repo/backend/convex/_generated/server";
import { getAppUserByAuthId } from "@repo/backend/convex/lib/helpers/user";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { v } from "convex/values";
import { nullable } from "convex-helpers/validators";

/**
 * Get app user by app user ID.
 * Returns null if user doesn't exist.
 */
export const getUserById = internalQuery({
  args: {
    userId: vv.id("users"),
  },
  returns: nullable(vv.doc("users")),
  handler: (ctx, args) => ctx.db.get("users", args.userId),
});

/**
 * Get app user by Better Auth user ID.
 * Returns null if user doesn't exist.
 */
export const getUserByAuthId = internalQuery({
  args: {
    authId: v.string(),
  },
  returns: nullable(vv.doc("users")),
  handler: (ctx, args) => getAppUserByAuthId(ctx, args.authId),
});
