import { internalAction } from "@repo/backend/convex/_generated/server";
import { createAuth } from "@repo/backend/convex/auth/runtime";

/**
 * Returns the latest Better Auth static JWKS payload for Convex env updates.
 *
 * Run with `convex run auth/actions:getLatestJwks | convex env set JWKS`.
 *
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
