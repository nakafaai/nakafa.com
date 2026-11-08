import type { Ref } from "@confect/core";
import type tryouts from "@repo/backend/confect/_generated/refs/tryouts";
import { saveTryoutResponseArgsValidator } from "@repo/backend/confect/tryouts/response/spec";
import type { ToastCopy } from "@repo/design-system/lib/toast/notify";
import { Cause, Match } from "effect";
import { keptAnswers } from "@/components/player/keep";
import { tryoutSubmitFailureOf } from "@/components/tryout/runtime/response/state";

/** A failed save of one pick: a refusal the server names, or a send that never reached it. */
type PickFailure =
  | Ref.Error<typeof tryouts.mutations.responses.save>
  | Cause.UnknownError;

/**
 * The try-out picks that the browser keeps until the server holds them, by placement, under one entry: a
 * placement belongs to one attempt, so its id names its pick alone. A cleared answer keeps no response. A
 * pick leaves once the server confirms it or refuses it for good, so the entry holds only what a closed page
 * left unsent.
 */
export const keptPicks = keptAnswers(
  saveTryoutResponseArgsValidator.fields.response
)("nakafa-tryout-kept");

/** The kind of a failed save, as `tryoutSubmitFailureOf` names it; a send that never reached the server is an error. */
const kindOf = (failure: PickFailure) =>
  Cause.isUnknownError(failure) ? "error" : tryoutSubmitFailureOf(failure.code);

/**
 * How the player reads a failed save of a pick: a newer write took its place, which says nothing, the attempt
 * or the section ended, which the server will never take back, or any other failure, which keeps the pick to
 * send again.
 */
export const pickRefusal = (failure: PickFailure) =>
  Match.value(kindOf(failure)).pipe(
    Match.when("stale", () => "quiet" as const),
    Match.when("ended", () => "final" as const),
    Match.orElse(() => "failed" as const)
  );

/** The toast of a failed save: an ended attempt asks the learner to start again, and any other says it did not save. */
export const pickCopy = (failure: PickFailure): ToastCopy =>
  kindOf(failure) === "ended"
    ? {
        description: "tryout-attempt-not-in-progress.description",
        title: "tryout-attempt-not-in-progress.title",
      }
    : {
        description: "tryout-submit-answer-error.description",
        title: "tryout-submit-answer-error.title",
      };
