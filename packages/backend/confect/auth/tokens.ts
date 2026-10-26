import { components } from "@repo/backend/confect/_generated/components";
import { MutationCtx } from "@repo/backend/confect/_generated/services";
import type { BetterAuthOptions } from "better-auth/minimal";
import type { GoogleOptions } from "better-auth/social-providers";
import {
  Array as Arr,
  Effect,
  Option,
  Predicate,
  pipe,
  Schema,
  String as Str,
} from "effect";
import { Base64Url } from "effect/encoding";

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

/** The one claim of a Google ID token that Nakafa keeps: the hosted domain, which only a Google Workspace account carries. */
const HostedDomainClaim = Schema.fromJsonString(
  Schema.Struct({ hd: Schema.optionalKey(Schema.String) })
);

/**
 * Google's hosted domain claim (`hd`) of an ID token, lowercase, or null for a
 * token without one, as a personal Google account's token is. The token comes
 * from Google's token endpoint during the sign-in that writes it, so its payload
 * is read without its signature, as Better Auth reads the profile in it. A
 * payload that cannot be read counts as one without the claim.
 * @see https://developers.google.com/identity/openid-connect/openid-connect#id_token-hd
 */
const hostedDomainOf = (idToken: string) =>
  pipe(
    Arr.get(Str.split(idToken, "."), 1),
    Option.flatMap((payload) =>
      Option.getSuccess(Base64Url.decodeString(payload))
    ),
    Option.flatMap(Schema.decodeOption(HostedDomainClaim)),
    Option.flatMap((claims) => Option.fromUndefinedOr(claims.hd)),
    Option.map(Str.toLowerCase),
    Option.getOrNull
  );

/**
 * What one write to `account` keeps of what Google issued: no token, and the
 * hosted domain of the ID token when the write carries one. A write without an
 * ID token, such as a token refresh, leaves the stored domain as it is.
 */
const issuedColumns = (account: { readonly idToken?: string | null }) => ({
  ...noProviderTokens,
  ...(Predicate.isString(account.idToken)
    ? { hostedDomain: hostedDomainOf(account.idToken) }
    : {}),
});

/**
 * Keeps the provider tokens out of every write to `account`, and keeps the
 * hosted domain that a school's allowed email domains check (ADR 0009). Sign-up,
 * a link, the update at each sign-in and a token refresh all write through
 * Better Auth's internal adapter, which runs these hooks first, so the domain is
 * the one of the latest sign-in.
 *
 * Better Auth merges what a hook returns over the data it is about to write, so
 * a column left out of the result would still be written. Each column is set to
 * `undefined` instead, and the adapter leaves an `undefined` column out of the
 * write.
 */
export const accountTokenHooks = {
  account: {
    create: {
      before: (account) => Promise.resolve({ data: issuedColumns(account) }),
    },
    update: {
      before: (account) => Promise.resolve({ data: issuedColumns(account) }),
    },
  },
} satisfies NonNullable<BetterAuthOptions["databaseHooks"]>;

/**
 * The most Google accounts of one account that a claim reads. Better Auth links
 * a Google account only on the account's own address, and Google gives one
 * address one account, so an account holds one; the rest is headroom.
 */
const GOOGLE_ACCOUNT_PAGE = 8;

/** The stored hosted domains of an account's Google accounts, as the component's adapter answers them. */
const GoogleAccounts = Schema.Struct({
  page: Schema.Array(
    Schema.Struct({
      hostedDomain: Schema.optionalKey(Schema.NullOr(Schema.String)),
    })
  ),
});

/**
 * The hosted domain of each Google account that an account holds, as its latest
 * sign-in wrote it: null for a personal Google account, and for one that has
 * not signed in since Nakafa keeps the claim. An account that never signed in
 * with Google holds none.
 */
export const googleHostedDomains = Effect.fn("auth.tokens.hostedDomains")(
  function* (authId: string) {
    const ctx = yield* MutationCtx;
    const answer = yield* Effect.promise(() =>
      ctx.runQuery(components.betterAuth.adapter.findMany, {
        model: "account",
        paginationOpts: { cursor: null, numItems: GOOGLE_ACCOUNT_PAGE },
        where: [
          { field: "userId", operator: "eq", value: authId },
          { field: "providerId", operator: "eq", value: "google" },
        ],
      })
    );
    const { page } = yield* Schema.decodeUnknownEffect(GoogleAccounts)(
      answer
    ).pipe(Effect.orDie);
    return Arr.map(page, (account) => account.hostedDomain ?? null);
  }
);

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
