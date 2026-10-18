import { APIError, createAuthMiddleware } from "better-auth/api";
import type { BetterAuthOptions } from "better-auth/minimal";
import { Array as Arr, Effect, Predicate } from "effect";

/**
 * The routes that read a stored provider token: `/get-access-token` and
 * `/account-info` return it, and `/refresh-token` refreshes it and writes the
 * new one. They are disabled paths, so the HTTP router answers 404 and the API
 * reference leaves them out, whether or not an older sign-in left a token on an
 * account.
 */
export const disabledTokenPaths = [
  "/account-info",
  "/get-access-token",
  "/refresh-token",
];

/**
 * The route that signs in with an email and a password. The HTTP router answers 404
 * for it, because it is a disabled path. A school username and a password sign in on
 * the school host alone, through `auth/login` (ADR 0009).
 */
export const disabledSignInPaths = ["/sign-in/email"];

const tokensNotStoredError = () =>
  APIError.from("NOT_FOUND", {
    code: "PROVIDER_TOKENS_NOT_STORED",
    message: "Nakafa stores no provider token.",
  });

/**
 * Refuses the same routes for a call from server code. Better Auth checks
 * `disabledPaths` in the HTTP router only, and `auth.api` runs an endpoint
 * without that check. A server call that sends no headers and names a `userId`
 * would return the token of that learner's account, so this answers it with the
 * same 404 (ADR 0009).
 */
export const tokenRoutesDisabled = {
  id: "token-routes-disabled",
  hooks: {
    before: [
      {
        handler: createAuthMiddleware(() =>
          Effect.runPromise(Effect.fail(tokensNotStoredError()))
        ),
        matcher: (context) =>
          Arr.some(disabledTokenPaths, (path) => path === context.path),
      },
    ],
  },
} satisfies NonNullable<BetterAuthOptions["plugins"]>[number];

/** The answer of a password sign-in that the host does not serve, the same for every caller. */
export const passwordSignInDisabledError = () =>
  APIError.from("NOT_FOUND", {
    code: "PASSWORD_SIGN_IN_DISABLED",
    message: "Sign-in with a password is not available.",
  });

/** The school username sign-in, which the HTTP router serves on a school host alone (ADR 0009). */
const USERNAME_SIGN_IN_PATH = "/sign-in/username";

/**
 * Refuses the password sign-in routes for a call from server code. A server call
 * to `auth.api.signInEmail` runs the endpoint without the router's `disabledPaths`
 * check, so a correct password would open a session. Every host refuses it, so no
 * account signs in with an email and a password here. A server call to the school
 * username sign-in carries no request, so it names no school host and is refused
 * too: only the router, which knows the host, serves that sign-in (`auth/login`).
 */
export const passwordSignInRoutesDisabled = {
  id: "password-sign-in-routes-disabled",
  hooks: {
    before: [
      {
        handler: createAuthMiddleware(() =>
          Effect.runPromise(Effect.fail(passwordSignInDisabledError()))
        ),
        matcher: (context) =>
          Arr.some(disabledSignInPaths, (path) => path === context.path) ||
          (context.path === USERNAME_SIGN_IN_PATH &&
            context.request === undefined),
      },
    ],
  },
} satisfies NonNullable<BetterAuthOptions["plugins"]>[number];

/** The profile fields of a Better Auth user that name the username. */
const usernameFields = ["displayUsername", "username"];

/** Whether an update-user body names a username field, even with no value. */
const namesUsername = (body: unknown) =>
  Predicate.isObject(body) &&
  Arr.some(usernameFields, (field) => Predicate.hasProperty(body, field));

const usernameUpdateDisabledError = () =>
  APIError.from("BAD_REQUEST", {
    code: "USERNAME_UPDATE_DISABLED",
    message: "A username changes only on the profile settings page.",
  });

/**
 * Refuses an update-user call that names a username, from a signed-in account or
 * from server code. The app's rename checks the reserved names and every holder
 * of a username, then changes the Better Auth username with it (ADR 0009). A raw
 * write would store a name the app refuses, and it would leave a second value.
 * A name, an image, or any other field still goes through update-user.
 */
export const usernameUpdatesDisabled = {
  id: "username-updates-disabled",
  hooks: {
    before: [
      {
        handler: createAuthMiddleware(() =>
          Effect.runPromise(Effect.fail(usernameUpdateDisabledError()))
        ),
        matcher: (context) =>
          context.path === "/update-user" && namesUsername(context.body),
      },
    ],
  },
} satisfies NonNullable<BetterAuthOptions["plugins"]>[number];
