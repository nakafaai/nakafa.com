import { APIError, createAuthMiddleware } from "better-auth/api";
import type { BetterAuthOptions } from "better-auth/minimal";
import { Array as Arr, Effect } from "effect";

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
