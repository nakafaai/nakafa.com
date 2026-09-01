import type {
  TryoutResponseSelection,
  TryoutResponseSpec,
} from "@repo/backend/convex/tryouts/response/model";
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
    if (selection.kind === "single-choice") {
      if (responseSpec.kind !== selection.kind) {
        return yield* responseKindMismatch;
      }
      return yield* evaluateSingleChoice(responseSpec, selection);
    }
    if (selection.kind === "multiple-choice") {
      if (responseSpec.kind !== selection.kind) {
        return yield* responseKindMismatch;
      }
      return yield* evaluateMultipleChoice(responseSpec, selection);
    }
    if (responseSpec.kind !== selection.kind) {
      return yield* responseKindMismatch;
    }
    return yield* evaluateCategory(responseSpec, selection);
  }
);

const evaluateSingleChoice = Effect.fn("tryouts.response.evaluateSingleChoice")(
  function* (
    responseSpec: Extract<TryoutResponseSpec, { kind: "single-choice" }>,
    selection: Extract<TryoutResponseSelection, { kind: "single-choice" }>
  ) {
    const option = responseSpec.options.find(
      ({ optionKey }) => optionKey === selection.optionKey
    );
    if (!option) {
      return yield* responseSelectionError(
        "TRYOUT_RESPONSE_SELECTION_INVALID",
        "Try-out selected option does not belong to this frozen question."
      );
    }
    return {
      isComplete: true,
      isCorrect: option.isCorrect,
      selection,
    } satisfies EvaluatedTryoutResponse;
  }
);

const evaluateMultipleChoice = Effect.fn(
  "tryouts.response.evaluateMultipleChoice"
)(function* (
  responseSpec: Extract<TryoutResponseSpec, { kind: "multiple-choice" }>,
  selection: Extract<TryoutResponseSelection, { kind: "multiple-choice" }>
) {
  const requested = new Set(selection.optionKeys);
  const options = new Map(
    responseSpec.options.map((option) => [option.optionKey, option])
  );
  if (
    requested.size === 0 ||
    requested.size !== selection.optionKeys.length ||
    requested.size > options.size ||
    [...requested].some((optionKey) => !options.has(optionKey))
  ) {
    return yield* responseSelectionError(
      "TRYOUT_RESPONSE_SELECTION_INVALID",
      "Try-out selected options do not belong to this frozen question."
    );
  }
  const optionKeys = responseSpec.options
    .filter(({ optionKey }) => requested.has(optionKey))
    .map(({ optionKey }) => optionKey);
  const correct = responseSpec.options
    .filter(({ isCorrect }) => isCorrect)
    .map(({ optionKey }) => optionKey);
  return {
    isComplete: true,
    isCorrect:
      optionKeys.length === correct.length &&
      correct.every((optionKey, index) => optionKeys[index] === optionKey),
    selection: { kind: selection.kind, optionKeys },
  } satisfies EvaluatedTryoutResponse;
});

const evaluateCategory = Effect.fn("tryouts.response.evaluateCategory")(
  function* (
    responseSpec: Extract<TryoutResponseSpec, { kind: "category" }>,
    selection: Extract<TryoutResponseSelection, { kind: "category" }>
  ) {
    const categories = new Set(
      responseSpec.categories.map(({ categoryKey }) => categoryKey)
    );
    const statements = new Map(
      responseSpec.statements.map((statement) => [
        statement.statementKey,
        statement,
      ])
    );
    const assignments = new Map(
      selection.assignments.map((assignment) => [
        assignment.statementKey,
        assignment,
      ])
    );
    if (
      selection.assignments.length === 0 ||
      assignments.size !== selection.assignments.length ||
      selection.assignments.some(
        ({ categoryKey, statementKey }) =>
          !(categories.has(categoryKey) && statements.has(statementKey))
      )
    ) {
      return yield* responseSelectionError(
        "TRYOUT_RESPONSE_SELECTION_INVALID",
        "Try-out category assignment does not belong to this frozen question."
      );
    }
    const canonicalAssignments = responseSpec.statements.flatMap(
      ({ statementKey }) => {
        const assignment = assignments.get(statementKey);
        return assignment ? [assignment] : [];
      }
    );
    const isComplete =
      canonicalAssignments.length === responseSpec.statements.length;
    return {
      isComplete,
      isCorrect:
        isComplete &&
        responseSpec.statements.every(
          ({ correctCategoryKey, statementKey }) =>
            assignments.get(statementKey)?.categoryKey === correctCategoryKey
        ),
      selection: {
        assignments: canonicalAssignments,
        kind: selection.kind,
      },
    } satisfies EvaluatedTryoutResponse;
  }
);

const responseKindMismatch = new TryoutResponseSelectionError({
  code: "TRYOUT_RESPONSE_KIND_MISMATCH",
  message: "Try-out response kind does not match its frozen question.",
});

function responseSelectionError(
  code: TryoutResponseSelectionError["code"],
  message: string
) {
  return new TryoutResponseSelectionError({ code, message });
}
