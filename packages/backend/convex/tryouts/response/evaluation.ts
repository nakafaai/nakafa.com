import type {
  TryoutResponseSelection,
  TryoutResponseSpec,
} from "@repo/backend/convex/tryouts/response/model";
import { evaluateTryoutResponseSelection } from "@repo/backend/convex/tryouts/response/selection";
import { Effect, Schema } from "effect";

/** A learner selection does not belong to its immutable response definition. */
export class TryoutResponseSelectionError extends Schema.TaggedError<TryoutResponseSelectionError>()(
  "TryoutResponseSelectionError",
  {
    code: Schema.Literals([
      "TRYOUT_RESPONSE_KIND_MISMATCH",
      "TRYOUT_RESPONSE_SELECTION_INVALID",
    ]),
    message: Schema.String,
  }
) {}

/** Canonical evaluated selection used by persistence, counters, and scoring. */
export interface EvaluatedTryoutResponse {
  readonly isComplete: boolean;
  readonly isCorrect: boolean;
  readonly selection: TryoutResponseSelection;
}

/** Validates and evaluates one selection against its frozen response contract. */
export const evaluateTryoutResponse = Effect.fn("tryouts.response.evaluate")(
  function* (
    responseSpec: TryoutResponseSpec,
    selection: TryoutResponseSelection
  ) {
    const evaluated = evaluateTryoutResponseSelection(responseSpec, selection);
    if (!evaluated.valid) {
      return yield* responseSelectionError(
        evaluated.reason === "kind-mismatch"
          ? "TRYOUT_RESPONSE_KIND_MISMATCH"
          : "TRYOUT_RESPONSE_SELECTION_INVALID",
        evaluated.reason === "kind-mismatch"
          ? "Try-out response kind does not match its frozen question."
          : "Try-out selection does not belong to this frozen question."
      );
    }
    return {
      isComplete: evaluated.isComplete,
      isCorrect: evaluated.isCorrect,
      selection: evaluated.selection,
    } satisfies EvaluatedTryoutResponse;
  }
);

function responseSelectionError(
  code: TryoutResponseSelectionError["code"],
  message: string
) {
  return new TryoutResponseSelectionError({ code, message });
}
