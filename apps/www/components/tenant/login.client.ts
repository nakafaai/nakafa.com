import { readCardCode } from "@repo/backend/confect/identity/code";
import type {
  RedeemOutcome,
  RedeemRefusal,
  RedeemRequest,
} from "@repo/backend/confect/identity/schema";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { randomUuid } from "@repo/utilities/uuid";
import { Effect, Match, Option, Result, Schema } from "effect";

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

/**
 * A redemption whose request got no answer, so the form cannot tell whether the card was spent.
 * It is not a refusal: a card that the school refuses answers a reason instead.
 */
export class RedeemUnanswered extends Schema.TaggedError<RedeemUnanswered>()(
  "RedeemUnanswered",
  {}
) {}

/** The copy key of a submission that does not sign the student in. */
type SubmitMessage =
  | "card-invalid"
  | "card-used"
  | "failed"
  | "sign-in-refused"
  | ReturnType<typeof redeemRefusalKey>;

/** What a submission leads to: the student signs in on this host, or the form shows a message. */
type SubmitStep = "signed-in" | SubmitMessage;

/**
 * The two requests of one submission: the card redemption, and the password sign-in. The page
 * passes its own, so the decision in `submitLogin` runs without a browser.
 */
interface SubmitPorts {
  readonly redeem: (
    request: typeof RedeemRequest.Type
  ) => Effect.Effect<typeof RedeemOutcome.Type, RedeemUnanswered>;
  readonly signIn: (credentials: {
    readonly password: string;
    readonly username: string;
  }) => Effect.Effect<boolean>;
}

/**
 * Decides one submission of the login form (ADR 0009). With no card code, the form signs the
 * student in with the typed name and password. With a card code, it redeems the card first, and
 * a redeemed card signs the student in. A card that answers `used` may be the retry of a
 * redemption whose reply was lost, so the password sign-in decides: it signs the student in
 * when the password is right, and otherwise the form shows that the card was used. Any other
 * refusal shows its own message.
 */
export const submitLogin = Effect.fn("www.tenant.login.submit")(function* (
  values: typeof LoginFormValues.Type,
  ports: SubmitPorts
): Effect.fn.Return<SubmitStep, never> {
  const credentials = {
    password: values.password,
    username: values.loginName,
  };
  if (values.code.trim() === "") {
    return (yield* ports.signIn(credentials)) ? "signed-in" : "sign-in-refused";
  }
  const request = redeemRequestOf(values);
  if (Option.isNone(request)) {
    return "card-invalid";
  }
  const redeemed = yield* ports.redeem(request.value).pipe(Effect.result);
  if (Result.isFailure(redeemed)) {
    return "failed";
  }
  const outcome = redeemed.success;
  if (outcome.outcome === "refused" && outcome.reason !== "used") {
    return redeemRefusalKey(outcome.reason);
  }
  if (yield* ports.signIn(credentials)) {
    return "signed-in";
  }
  return outcome.outcome === "redeemed" ? "sign-in-refused" : "card-used";
});

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
