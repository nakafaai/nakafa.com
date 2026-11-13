import { MutationCtx } from "@repo/backend/confect/_generated/services";
import { AGENT_TOKEN_AUDIENCE } from "@repo/backend/confect/auth/grant/audience";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Duration, Effect } from "effect";

/** How long an agent's access token lives. Revoking the grant ends it at once (`auth/caller`). */
export const AGENT_TOKEN_LIFETIME = Duration.minutes(15);

/** How long a grant lasts without a refresh. Each refresh renews it. */
export const GRANT_LIFETIME = Duration.days(30);

/** How long an authorization code waits for its exchange. */
export const CODE_LIFETIME = Duration.minutes(10);

/** The scope of every grant: the sign-in, and the refresh token that outlives an access token. */
export const AGENT_SCOPE = "openid offline_access";

/**
 * Signs the access token of a grant with the deployment's own key. Its subject
 * is the grant, so a function resolves the agent's person through the grant row
 * and a deleted grant names nobody.
 * https://docs.convex.dev/auth/convex-auth/getting-started
 */
export const signAgentToken = Effect.fn("auth.grant.sign")(function* (
  grantId: Id<"agentGrants">
) {
  const ctx = yield* MutationCtx;
  return yield* Effect.promise(() =>
    ctx.auth.signJwt({
      claims: { aud: AGENT_TOKEN_AUDIENCE, sub: grantId },
      expiresInSeconds: Duration.toSeconds(AGENT_TOKEN_LIFETIME),
    })
  );
});

/** The token answer of RFC 6749 section 5.1, as the token endpoint writes it. */
export const tokenAnswer = (accessToken: string, refreshToken: string) => ({
  access_token: accessToken,
  expires_in: Duration.toSeconds(AGENT_TOKEN_LIFETIME),
  refresh_token: refreshToken,
  scope: AGENT_SCOPE,
  token_type: "Bearer" as const,
});
