import { internalQuery, query } from "@repo/backend/convex/_generated/server";
import { requireAuth } from "@repo/backend/convex/lib/helpers/auth";
import { getAppUserByAuthId } from "@repo/backend/convex/lib/helpers/user";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { userRoleValidator } from "@repo/backend/convex/users/schema";
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

/**
 * Get user info for chat.
 * Requires authentication.
 * Returns the user's role and credits.
 */
export const getUserInfoForChat = query({
  args: {},
  returns: v.object({
    role: nullable(userRoleValidator),
    credits: v.number(),
  }),
  handler: async (ctx) => {
    const user = await requireAuth(ctx);
    return {
      role: user.appUser.role ?? null,
      credits: user.appUser.credits,
    };
  },
});
