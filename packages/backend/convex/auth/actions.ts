import { internalAction } from "@repo/backend/convex/_generated/server";
import { createAuth } from "@repo/backend/convex/auth/runtime";
import authSchema from "@repo/backend/convex/betterAuth/schema";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { v } from "convex/values";

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
  returns: v.array(
    authSchema.tables.jwks.validator.extend({
      id: v.string(),
      alg: v.literal("RS256"),
    })
  ),
  handler: async (ctx) => {
    const auth = await runConvexProgram(createAuth(ctx));

    return auth.api.getLatestJwks();
  },
});
