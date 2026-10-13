import type { AttemptRefused } from "@repo/backend/confect/assessment/gate/refusal";
import type { rules } from "@repo/backend/confect/assessment/gate/rules";
import { TryoutAttemptStateError } from "@repo/backend/confect/tryouts/attempt";
import { TryoutResponseError } from "@repo/backend/confect/tryouts/response/spec";
import { Match } from "effect";

const attemptNotActive = () =>
  new TryoutAttemptStateError({
    code: "TRYOUT_ATTEMPT_NOT_ACTIVE",
    message: "Try-out attempt is not active.",
  });
const sectionNotActive = () =>
  new TryoutAttemptStateError({
    code: "TRYOUT_SECTION_NOT_ACTIVE",
    message: "Try-out section is not active.",
  });

/** The rows both writes map alike: try-out attempts never lock or bind a device, so those rows only keep each mapping total. */
const unavailable = {
  AttemptClosed: attemptNotActive,
  Locked: attemptNotActive,
  OtherDevice: attemptNotActive,
  SectionClosed: sectionNotActive,
};

/**
 * Maps one refused try-out write onto an error its function already declares,
 * so no deployed error union changes. Answers keep the response vocabulary for
 * a missing question and a passed deadline; a finish keeps the attempt state
 * codes it has always returned.
 */
export const toTryoutFailure = {
  answer: (refused: AttemptRefused) =>
    Match.valueTags(refused.reason, {
      ...unavailable,
      Expired: () =>
        new TryoutResponseError({
          code: "TRYOUT_EXPIRED",
          message: "Try-out attempt time has expired.",
        }),
      Missing: () =>
        new TryoutResponseError({
          code: "TRYOUT_PLACEMENT_NOT_FOUND",
          message: "Try-out question placement not found.",
        }),
    }),
  finish: (refused: AttemptRefused) =>
    Match.valueTags(refused.reason, {
      ...unavailable,
      Expired: () =>
        new TryoutAttemptStateError({
          code: "TRYOUT_ATTEMPT_NOT_ACTIVE",
          message: "Try-out attempt time has expired.",
        }),
      Missing: () =>
        new TryoutAttemptStateError({
          code: "TRYOUT_ATTEMPT_NOT_FOUND",
          message: "Try-out attempt not found.",
        }),
    }),
} satisfies Record<
  keyof typeof rules,
  (refused: AttemptRefused) => TryoutAttemptStateError | TryoutResponseError
>;

/** The error of an answer that a newer answer of the same question overtook. */
export function toTryoutStale() {
  return new TryoutResponseError({
    code: "TRYOUT_RESPONSE_STALE",
    message: "Try-out response was replaced by a newer one.",
  });
}
