import { ConvexConfigProvider } from "@confect/server";
import authSchema from "@repo/backend/components/betterAuth/schema";
import { createAuth } from "@repo/backend/confect/auth/runtime";
import { internalAction } from "@repo/backend/convex/_generated/server";
import { v } from "convex/values";
import { Effect } from "effect";

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
    const auth = await Effect.runPromise(
      createAuth(ctx).pipe(Effect.provide(ConvexConfigProvider.layer))
    );
    return auth.api.getLatestJwks();
  },
});
