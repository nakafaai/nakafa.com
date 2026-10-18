import { readCardCode } from "@repo/backend/confect/identity/code";
import type {
  RedeemRefusal,
  RedeemRequest,
} from "@repo/backend/confect/identity/schema";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { randomUuid } from "@repo/utilities/uuid";
import { Effect, Match, Option, Schema } from "effect";

/** What the login form holds when a student submits it, before the card is read. */
const LoginFormValues = Schema.Struct({
  code: Schema.String,
  deviceId: Schema.String,
  loginName: Schema.String,
  password: Schema.String,
  slug: TenantSlug,
});

/**
 * The card redemption that the form sends. The code is read the way a student types
 * it, so spaces and dashes drop and O, I, and L read as 0 and 1. None means the text is
 * not a card code, so the form shows the card message without a request.
 */
export const redeemRequestOf = (
  values: typeof LoginFormValues.Type
): Option.Option<typeof RedeemRequest.Type> =>
  Option.map(readCardCode(values.code), (code) => ({
    code,
    deviceId: values.deviceId,
    loginName: values.loginName,
    password: values.password,
    slug: values.slug,
  }));

/**
 * The copy key of the message that a refused card shows. A refusal that names no card
 * problem, such as a wrong login name or code, reads as `card-invalid`, which says
 * nothing about whether the login name exists.
 */
export const redeemRefusalKey = (reason: typeof RedeemRefusal.Type) =>
  Match.value(reason).pipe(
    Match.when("expired", () => "card-expired" as const),
    Match.when("invalid", () => "card-invalid" as const),
    Match.when("passwordTooLong", () => "password-too-long" as const),
    Match.when("passwordTooShort", () => "password-too-short" as const),
    Match.when("rateLimited", () => "card-rate-limited" as const),
    Match.when("used", () => "card-used" as const),
    Match.exhaustive
  );

/** The device id of this page load, which the card's rate limit counts attempts against. */
let pageDeviceId: string | undefined;

/**
 * The device of this page: one UUID for every attempt the page makes. A page that reloads
 * starts a new device, which the card's limit allows, because a code holds 50 bits.
 */
export const pageDeviceIdOf = Effect.fn("www.tenant.login.device")(
  function* () {
    if (pageDeviceId === undefined) {
      pageDeviceId = yield* randomUuid;
    }
    return pageDeviceId;
  }
);
