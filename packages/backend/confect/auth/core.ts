import { setupGoogle } from "@convex-dev/auth/methods/google/server";
import { setupUsernamePassword } from "@convex-dev/auth/methods/username-password/server";
import { setupConvexAuth } from "@convex-dev/auth/server";
import { components } from "@repo/backend/confect/_generated/components";
import { readSiteUrls } from "@repo/backend/confect/site/config";
import { internal } from "@repo/backend/convex/_generated/api";
import { ConvexConfigProvider } from "@confect/server";
import { Array as Arr, Duration, Effect } from "effect";

/**
 * How long an access token lives. A function resolves its caller through the
 * session row on every call (`getAuthUserId`), so a signed-out session stops at
 * once whatever this is; it only sets how often a tab asks for a new token.
 */
const ACCESS_TOKEN_LIFETIME = Duration.minutes(15);

/** How long a session may go unused before it ends, as Nakafa's sessions always have. */
const IDLE_LIFETIME = Duration.days(7);

/** How long a session may last at most, however often it is used. */
const SESSION_LIFETIME = Duration.days(90);

/**
 * Convex Auth's core: sessions, refresh tokens, and the access tokens that the
 * deployment signs with its own key.
 * https://docs.convex.dev/auth/convex-auth/getting-started
 */
const core = setupConvexAuth({
  component: components.auth,
  accessTokenTtlSeconds: Duration.toSeconds(ACCESS_TOKEN_LIFETIME),
  refreshInactivityTimeoutSeconds: Duration.toSeconds(IDLE_LIFETIME),
  sessionMaxLifetimeSeconds: Duration.toSeconds(SESSION_LIFETIME),
});

/**
 * The sites a Google sign-in may return to: production's site, or the dev
 * deployment's local and staging sites. A school host starts its sign-in on the
 * main site, whose cookie every school host shares (ADR 0026). Convex runs this
 * when it loads the module, so a deployment without a site refuses the push.
 */
const redirectOrigins = Effect.runSync(
  readSiteUrls().pipe(
    Effect.map((sites) => Arr.map(sites, (site) => site.origin)),
    Effect.provide(ConvexConfigProvider.layer)
  )
);

export const { signOut, refreshSession, isAuthenticated } = core;

/** Google sign-in, which links the account of the address Google verified (ADR 0009). */
export const { startSignInWithGoogle, completeSignInWithGoogle } = setupGoogle(
  core,
  { component: components.authGoogle, allowedRedirectOrigins: redirectOrigins }
).attachUserCallbacks({
  createUser: internal.auth.account.createGoogle,
  onSignIn: internal.auth.account.signInGoogle,
});

/**
 * A school account's password sign-in. Its username is the account's own id,
 * which the school login resolves (`auth/school`), so a school login name never
 * reaches it and nobody signs up: the school makes every school account.
 */
export const { signInWithUsernamePassword } = setupUsernamePassword(core, {
  component: components.authPassword,
  usernameComponent: components.authUsername,
}).attachUserCallbacks({
  createUser: internal.auth.account.createSchool,
});
