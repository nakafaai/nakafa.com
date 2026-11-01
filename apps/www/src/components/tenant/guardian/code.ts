import { Email } from "@repo/backend/confect/tenancy/schema";
import { Effect, Match, Option, Schema, String as Str } from "effect";

/**
 * The address a guardian types, as the code request sends it: trimmed and in lowercase,
 * the form the school's link holds. None means the text is no address, so the form says so
 * without a request.
 */
export const guardianEmailOf = (typed: string) =>
  Schema.decodeOption(Email)(Str.toLowerCase(Str.trim(typed)));

/** The shape of a guardian's sign-in code: six digits. */
const CODE_PATTERN = /^\d{6}$/u;

/** The six digits of a typed code, with spaces dropped. None means the text is not a code. */
export const guardianCodeOf = (typed: string) =>
  Option.liftPredicate(Str.replaceAll(" ", "")(typed), (code) =>
    CODE_PATTERN.test(code)
  );

/** The sentence under a sign-in step's field, when there is one. */
const SignInMessage = Schema.UndefinedOr(Schema.String);

/**
 * Where a parent's sign-in stands: writing the address, or writing the code of the address
 * the school mailed. Each step holds its own field, so a code never stands without its address.
 */
const GuardianSignIn = Schema.Union([
  Schema.TaggedStruct("email", {
    email: Schema.String,
    message: SignInMessage,
  }),
  Schema.TaggedStruct("code", {
    code: Schema.String,
    message: SignInMessage,
    sentTo: Schema.String,
  }),
]);
type GuardianSignIn = typeof GuardianSignIn.Type;

/** One change to the sign-in: a key in the field, a sentence, a request on its way, or a mailed code. */
const SignInChange = Schema.Union([
  Schema.TaggedStruct("refused", { message: Schema.String }),
  Schema.TaggedStruct("sent", { address: Schema.String }),
  Schema.TaggedStruct("typed", { text: Schema.String }),
  Schema.TaggedStruct("waiting", {}),
]);

/** The sign-in as a parent finds it: an empty address. */
export const SIGN_IN_START: GuardianSignIn = {
  _tag: "email",
  email: "",
  message: undefined,
};

/** The sign-in after one change. A mailed code starts the code step empty, on a resend too. */
export function stepSignIn(
  form: GuardianSignIn,
  change: typeof SignInChange.Type
): GuardianSignIn {
  return Match.valueTags(change, {
    refused: ({ message }) => ({ ...form, message }),
    sent: ({ address }) => ({
      _tag: "code" as const,
      code: "",
      message: undefined,
      sentTo: address,
    }),
    typed: ({ text }) =>
      form._tag === "email"
        ? { ...form, email: text }
        : { ...form, code: text },
    waiting: () => ({ ...form, message: undefined }),
  });
}

/**
 * A code sign-in whose request got no answer, or whose server failed. It is not a refusal:
 * a wrong code answers a status below 500, which the form reads as refused.
 */
export class GuardianSignInUnanswered extends Schema.TaggedError<GuardianSignInUnanswered>()(
  "GuardianSignInUnanswered",
  {}
) {}

/**
 * Reads the answer of one code sign-in from the status of its error. No error status means the
 * server signed the guardian in, and a status below 500 means it refused the code. A server
 * failure is unanswered, so an outage never reads as a wrong code.
 */
export const guardianSignInAnswerOf = Effect.fn(
  "www.tenant.guardian.signInAnswer"
)(function* (
  errorStatus: number | undefined
): Effect.fn.Return<boolean, GuardianSignInUnanswered> {
  if (errorStatus === undefined) {
    return true;
  }
  if (errorStatus >= 500) {
    return yield* new GuardianSignInUnanswered();
  }
  return false;
});
