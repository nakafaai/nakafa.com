import { Id } from "@repo/backend/confect/_generated/id";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Schema } from "effect";

/** The fewest and most characters a school login name holds. */
export const LOGIN_NAME_MIN_LENGTH = 3;
export const LOGIN_NAME_MAX_LENGTH = 32;
/** The characters a school login name may hold: lowercase letters, digits, dots, underscores, and hyphens. */
export const LOGIN_NAME_PATTERN = /^[a-z0-9._-]+$/;

/**
 * A school login name: the name a student types on the school host. The
 * reserved names are refused when a name is read, not here, so a stored name
 * is always well formed.
 */
export const LoginName = Schema.String.check(
  Schema.isMinLength(LOGIN_NAME_MIN_LENGTH),
  Schema.isMaxLength(LOGIN_NAME_MAX_LENGTH),
  Schema.isPattern(LOGIN_NAME_PATTERN)
);

/** The school's login name of one Person. The name is unique within its school. */
export const schoolLoginValidator = Schema.Struct({
  name: LoginName,
  personId: Id("tenantPeople"),
  tenantId: Id("tenants"),
});

/**
 * One login card of a Person. Only a keyed hash of the code is stored, never
 * the code. Issuing a new card replaces the row, which voids the old code.
 */
export const loginCardValidator = Schema.Struct({
  codeHash: Schema.String,
  expiresAt: Schema.Finite,
  issuedAt: Schema.Finite,
  issuedBy: Id("tenantPeople"),
  personId: Id("tenantPeople"),
  redeemedAt: Schema.optionalKey(Schema.Finite),
  tenantId: Id("tenants"),
});

/** One issued card as the school's Admin sees it: the plain code, shown once, with its login name, its expiry, and its Person. */
export const IssuedCard = Schema.Struct({
  code: Schema.String,
  expiresAt: Schema.Finite,
  loginName: LoginName,
  personId: Id("tenantPeople"),
});

/**
 * What a student sends to redeem a card: the school login name and the code as
 * typed, the device that types it, the new password, and the school's host, which
 * names the school. The login name must be the card's own, so a card typed with
 * another name does not open.
 */
export const RedeemRequest = Schema.Struct({
  code: Schema.String,
  deviceId: Schema.String.check(Schema.isUUID()),
  loginName: Schema.String,
  password: Schema.String,
  slug: TenantSlug,
});

/** Why a card cannot be redeemed. None of them tells a guesser which part of a code was right. */
export const RedeemRefusal = Schema.Literals([
  "expired",
  "invalid",
  "passwordTooLong",
  "passwordTooShort",
  "rateLimited",
  "used",
]);

/**
 * The Better Auth username that a school login signs in with on its school's
 * host, or none. `missing` covers an unknown name, a Person who is removed or has
 * no account yet, and a login name that the school cannot hold, so the answer
 * never tells a visitor which of them held.
 */
export const LoginUsername = Schema.Union([
  Schema.Struct({
    outcome: Schema.Literal("found"),
    username: Schema.String,
  }),
  Schema.Struct({
    outcome: Schema.Literal("missing"),
  }),
]).pipe(Schema.toTaggedUnion("outcome"));

/**
 * What redeeming a card answers. A refusal is a value, not an error, so that
 * the attempt it refuses still counts against the rate limit: a failed mutation
 * would roll that count back.
 */
export const RedeemOutcome = Schema.Union([
  Schema.Struct({
    loginName: LoginName,
    outcome: Schema.Literal("redeemed"),
  }),
  Schema.Struct({
    outcome: Schema.Literal("refused"),
    reason: RedeemRefusal,
  }),
]).pipe(Schema.toTaggedUnion("outcome"));
