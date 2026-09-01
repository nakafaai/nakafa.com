import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type {
  TryoutResponseSelection,
  TryoutResponseSpec,
} from "@repo/backend/convex/tryouts/response/model";
import { validateTryoutResponseSpec } from "@repo/backend/convex/tryouts/response/validation";
import { Effect, Schema } from "effect";

interface LegacyTryoutChoice {
  readonly isCorrect: boolean;
  readonly label: string;
  readonly optionKey: string;
  readonly order: number;
}

/** Temporary malformed legacy response detected before terminal migration. */
export class LegacyTryoutResponseError extends Schema.TaggedError<LegacyTryoutResponseError>()(
  "LegacyTryoutResponseError",
  { message: Schema.String }
) {}

/** Reads either side of the bounded placement rollout into one stable model. */
export const resolvePlacementResponseSpec = Effect.fn(
  "tryouts.response.resolvePlacementSpec"
)(function* (placement: Doc<"tryoutAttemptPlacements">) {
  if (placement.responseSpec) {
    return yield* validateTryoutResponseSpec(placement.responseSpec);
  }
  if (!placement.choiceSnapshots) {
    return yield* new LegacyTryoutResponseError({
      message: "Try-out placement has no frozen response definition.",
    });
  }
  return yield* responseSpecFromLegacyChoices(placement.choiceSnapshots);
});

/** Reads either side of the bounded learner-response rollout. */
export const resolveStoredResponseSelection = Effect.fn(
  "tryouts.response.resolveStoredSelection"
)(function* (response: Doc<"tryoutResponses">) {
  if (response.selection) {
    return response.selection;
  }
  if (response.selectedOptionId !== undefined) {
    return {
      kind: "single-choice",
      optionKey: response.selectedOptionId,
    } satisfies TryoutResponseSelection;
  }
  return yield* new LegacyTryoutResponseError({
    message: "Try-out response has no supported learner selection.",
  });
});

/** Converts one legacy single-choice snapshot into the canonical response seam. */
export const responseSpecFromLegacyChoices = Effect.fn(
  "tryouts.response.fromLegacyChoices"
)(function* (choices: readonly LegacyTryoutChoice[]) {
  const ordered = [...choices].sort((left, right) => left.order - right.order);
  if (
    ordered.length === 0 ||
    ordered.filter(({ isCorrect }) => isCorrect).length !== 1 ||
    new Set(ordered.map(({ optionKey }) => optionKey)).size !==
      ordered.length ||
    new Set(ordered.map(({ order }) => order)).size !== ordered.length
  ) {
    return yield* new LegacyTryoutResponseError({
      message: "Legacy try-out choices do not form one single-choice response.",
    });
  }
  const responseSpec = {
    kind: "single-choice",
    options: ordered,
  } satisfies TryoutResponseSpec;
  return yield* validateTryoutResponseSpec(responseSpec).pipe(
    Effect.mapError(
      (cause) => new LegacyTryoutResponseError({ message: cause.message })
    )
  );
});
