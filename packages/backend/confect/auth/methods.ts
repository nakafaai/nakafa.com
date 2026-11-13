import { Schema } from "effect";

/**
 * The account profile that Convex Auth's Google method passes to Nakafa's user
 * callbacks, field for field (`vGoogleProfile`). `id` is Google's `sub`.
 * https://docs.convex.dev/auth/convex-auth/methods/oauth
 */
export const GoogleProfile = Schema.Struct({
  id: Schema.String,
  email: Schema.optionalKey(Schema.String),
  emailVerified: Schema.Boolean,
  name: Schema.optionalKey(Schema.String),
  picture: Schema.optionalKey(Schema.String),
});

/** The Google method as Convex Auth names it to the user callbacks. */
export const GoogleMethod = Schema.Struct({
  name: Schema.Literal("google"),
  profile: GoogleProfile,
});

/** The username and password method as Convex Auth names it to the user callbacks. */
export const SchoolMethod = Schema.Struct({
  name: Schema.Literal("usernamePassword"),
  profile: Schema.Struct({}),
});

/**
 * Google gave no address for the account, or one it did not verify. Every
 * Nakafa address with a mailbox is one Google verified, which billing and
 * school invites rely on, so no account is made or found without one.
 */
export class GoogleAddressRefused extends Schema.TaggedError<
  GoogleAddressRefused,
  { readonly brand: unique symbol }
>()("GoogleAddressRefused", {
  code: Schema.Literals(["GOOGLE_ADDRESS_MISSING", "GOOGLE_ADDRESS_UNVERIFIED"]),
  message: Schema.String,
}) {}

/**
 * The account that a sign-in names is deleted. Convex Auth keeps the Google
 * account linked to the deleted account's id, so that Google account cannot
 * sign in again.
 */
export class AccountDeleted extends Schema.TaggedError<
  AccountDeleted,
  { readonly brand: unique symbol }
>()("AccountDeleted", {
  code: Schema.Literal("ACCOUNT_DELETED"),
  message: Schema.String,
}) {}

/** Nobody signs up with a password: the school makes every school account (ADR 0009). */
export class SchoolSignUpRefused extends Schema.TaggedError<
  SchoolSignUpRefused,
  { readonly brand: unique symbol }
>()("SchoolSignUpRefused", {
  code: Schema.Literal("SCHOOL_SIGN_UP_REFUSED"),
  message: Schema.String,
}) {}

/** The tokens of a session that a sign-in made, as Convex Auth answers them. */
const SessionTokens = Schema.Struct({
  accessToken: Schema.String,
  refreshToken: Schema.String,
  refreshTokenExpiresAt: Schema.Finite,
  userId: Schema.String,
});

/**
 * The answer of a school sign-in, in the envelope Convex Auth's sign-in route
 * forwards: the session's tokens, which the route moves into cookies, or one
 * refusal for every cause, so a visitor never learns whether a login name
 * exists on the school or whether its attempts ran out (ADR 0009).
 */
export const SchoolSignIn = Schema.Union([
  Schema.Struct({ status: Schema.Literal("complete"), tokens: SessionTokens }),
  Schema.Struct({
    status: Schema.Literal("error"),
    userError: Schema.Struct({ error: Schema.Literal("INVALID_CREDENTIALS") }),
  }),
]);
