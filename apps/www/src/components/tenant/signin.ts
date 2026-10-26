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

/**
 * A password sign-in whose request got no answer, or whose server failed to answer. It is not a
 * refusal: a wrong password answers an error status below 500, which the form reads as a refusal.
 */
export class SignInUnanswered extends Schema.TaggedError<SignInUnanswered>()(
  "SignInUnanswered",
  {}
) {}

/**
 * Reads the answer of one password sign-in from the status of its error. No error status means
 * the server signed the student in, and a status below 500 means it refused the password. A server
 * failure is unanswered, so an outage never reads as a wrong password.
 */
export const signInAnswerOf = Effect.fn("www.tenant.login.signInAnswer")(
  function* (
    errorStatus: number | undefined
  ): Effect.fn.Return<boolean, SignInUnanswered> {
    if (errorStatus === undefined) {
      return true;
    }
    if (errorStatus >= 500) {
      return yield* new SignInUnanswered();
    }
    return false;
  }
);

/** The copy key of a submission that does not sign the student in. */
type SubmitMessage =
  | "card-invalid"
  | "card-used"
  | "failed"
  | "sign-in-missing"
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
  }) => Effect.Effect<boolean, SignInUnanswered>;
}

/** The credentials of one password sign-in, as the form sends them. */
type SignInCredentials = Parameters<SubmitPorts["signIn"]>[0];

/**
 * The password sign-in of one submission. The student is signed in when the server accepts the
 * password, and `refusal` is the message for a password that it refuses. A sign-in that got no
 * answer shows the failure message instead, so a lost request never reads as a wrong password.
 */
const passwordSignIn = (
  ports: SubmitPorts,
  credentials: SignInCredentials,
  refusal: SubmitMessage
): Effect.Effect<SubmitStep> =>
  ports.signIn(credentials).pipe(
    Effect.map((signedIn) => (signedIn ? "signed-in" : refusal)),
    Effect.catchTag("SignInUnanswered", () =>
      Effect.succeed<SubmitStep>("failed")
    )
  );

/**
 * Decides one submission of the login form (ADR 0009). A form without the username or the
 * password answers at once, without a request, because every way in needs both. With no card
 * code, the form signs the student in with the typed name and password. With a card code, it
 * redeems the card first, and a redeemed card signs the student in. A card that answers `used`
 * may be the retry of a redemption whose reply was lost, so the password sign-in decides: it
 * signs the student in when the password is right, and otherwise the form shows that the card
 * was used. Any other refusal shows its own message, and a sign-in that got no answer shows the
 * failure message.
 */
export const submitLogin = Effect.fn("www.tenant.login.submit")(function* (
  values: typeof LoginFormValues.Type,
  ports: SubmitPorts
): Effect.fn.Return<SubmitStep, never> {
  if (values.loginName.trim() === "" || values.password === "") {
    return "sign-in-missing";
  }
  const credentials = {
    password: values.password,
    username: values.loginName,
  };
  if (values.code.trim() === "") {
    return yield* passwordSignIn(ports, credentials, "sign-in-refused");
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
  return yield* passwordSignIn(
    ports,
    credentials,
    outcome.outcome === "redeemed" ? "sign-in-refused" : "card-used"
  );
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
