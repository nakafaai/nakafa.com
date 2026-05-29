import { query } from "@repo/backend/convex/_generated/server";
import { getOptionalAppUser } from "@repo/backend/convex/lib/helpers/auth";
import { vv } from "@repo/backend/convex/lib/validators/vv";

/** Get the authenticated Better Auth user and matching app user, if present. */
export const getCurrentUser = query({
  args: {},
  handler: (ctx) => getOptionalAppUser(ctx),
});

/** Get a public user profile by app user id. */
export const getUserById = query({
  args: { userId: vv.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get("users", args.userId);

    if (!user) {
      return null;
    }

    return {
      image: user.image ?? undefined,
      name: user.name,
    };
  },
});
