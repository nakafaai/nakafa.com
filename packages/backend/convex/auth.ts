import { internalAction, query } from "@repo/backend/convex/_generated/server";
import { createAuth } from "@repo/backend/convex/auth/runtime";
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

/**
 * Refresh the static JWKS value at the documented `auth:getLatestJwks` path.
 *
 * @see https://better-auth.com/docs/integrations/convex
 * @see https://labs.convex.dev/better-auth/experimental#static-jwks
 * @see https://docs.convex.dev/functions/query-functions#query-names
 */
export const getLatestJwks = internalAction({
  args: {},
  handler: (ctx) => {
    const auth = createAuth(ctx);

    return auth.api.getLatestJwks();
  },
});
