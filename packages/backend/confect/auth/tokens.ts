import type { BetterAuthOptions } from "better-auth/minimal";
import type { GoogleOptions } from "better-auth/social-providers";

/**
 * The `account` columns that hold what Google issued at sign-in: the access,
 * refresh and ID tokens and their expiry times, all unset. Nothing in Nakafa
 * reads them after sign-in, so Better Auth stores none of them.
 */
const noProviderTokens = {
  accessToken: undefined,
  accessTokenExpiresAt: undefined,
  idToken: undefined,
  refreshToken: undefined,
  refreshTokenExpiresAt: undefined,
};

/**
 * Keeps the provider tokens out of every write to `account`. Sign-up, a link,
 * the update at each sign-in and a token refresh all write through Better
 * Auth's internal adapter, which runs these hooks first (ADR 0009).
 *
 * Better Auth merges what a hook returns over the data it is about to write, so
 * a column left out of the result would still be written. Each column is set to
 * `undefined` instead, and the adapter leaves an `undefined` column out of the
 * write.
 */
export const accountTokenHooks = {
  account: {
    create: {
      before: () => Promise.resolve({ data: noProviderTokens }),
    },
    update: {
      before: () => Promise.resolve({ data: noProviderTokens }),
    },
  },
} satisfies NonNullable<BetterAuthOptions["databaseHooks"]>;

/**
 * What sign-in asks Google for. It sends no `access_type`, which Google reads
 * as `online`, so Google issues no refresh token. It sends no `consent`
 * prompt, which made Google show its consent screen at every sign-in.
 * `select_account` stays, so a learner with several Google accounts still
 * picks one.
 *
 * Only the redirect flow signs a learner in. With ID token sign-in on, Better
 * Auth would accept any Google ID token that was issued to Nakafa in the last
 * hour as a login credential, both to sign a learner in and to link an account.
 * @see https://developers.google.com/identity/protocols/oauth2/web-server
 */
export const googleSignIn = {
  disableIdTokenSignIn: true,
  prompt: "select_account",
} satisfies Partial<GoogleOptions>;
