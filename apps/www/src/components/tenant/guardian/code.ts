import { Email } from "@repo/backend/confect/tenancy/schema";
import { Effect, Option, Schema, String as Str } from "effect";

/**
 * The address a guardian types, as the code request sends it: trimmed and in lowercase,
 * the form the school's link holds. None means the text is no address, so the form says so
 * without a request.
 */
export const guardianEmailOf = (typed: string) =>
  Schema.decodeOption(Email)(Str.toLowerCase(Str.trim(typed)));

/** The shape of a guardian's sign-in code: six digits. */
const CODE_PATTERN = /^\d{6}$/;

/** The six digits of a typed code, with spaces dropped. None means the text is not a code. */
export const guardianCodeOf = (typed: string) =>
  Option.liftPredicate(Str.replaceAll(" ", "")(typed), (code) =>
    CODE_PATTERN.test(code)
  );

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
