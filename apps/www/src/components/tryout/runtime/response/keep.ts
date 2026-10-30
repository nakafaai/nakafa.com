import type { Ref } from "@confect/core";
import type tryouts from "@repo/backend/confect/_generated/refs/tryouts";
import { saveTryoutResponseArgsValidator } from "@repo/backend/confect/tryouts/response/spec";
import { Cause } from "effect";
import { keptAnswers } from "@/components/player/keep";
import { tryoutSubmitFailureOf } from "@/components/tryout/runtime/response/state";

/**
 * The try-out picks that the browser keeps until the server holds them, by placement, under one entry: a
 * placement belongs to one attempt, so its id names its pick alone. A cleared answer keeps no selection. A
 * pick leaves once the server confirms it or refuses it for good, so the entry holds only what a closed page
 * left unsent.
 */
export const keptPicks = keptAnswers(
  saveTryoutResponseArgsValidator.fields.selection
)("nakafa-tryout-kept");

/**
 * Whether the server will never take a refused pick: a newer write took its place, or the attempt or the
 * section ended. A send that never reached the server, and any other refusal, keeps the pick to send again.
 */
export function isFinalPickRefusal(
  failure:
    | Ref.Error<typeof tryouts.mutations.responses.save>
    | Cause.UnknownError
) {
  return (
    !Cause.isUnknownError(failure) &&
    tryoutSubmitFailureOf(failure.code) !== "error"
  );
}
