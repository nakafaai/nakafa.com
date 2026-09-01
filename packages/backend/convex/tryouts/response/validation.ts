import type { TryoutResponseSpec } from "@repo/backend/convex/tryouts/response/model";
import { Effect, Schema } from "effect";

/** A frozen response definition violates the stable runtime invariants. */
export class TryoutResponseDefinitionError extends Schema.TaggedError<TryoutResponseDefinitionError>()(
  "TryoutResponseDefinitionError",
  { message: Schema.String }
) {}

/** Validates identities, answer keys, ordering, and Markdown labels. */
export const validateTryoutResponseSpec = Effect.fn(
  "tryouts.response.validateDefinition"
)(function* (responseSpec: TryoutResponseSpec) {
  if (responseSpec.kind === "category") {
    if (!hasValidCategoryDefinition(responseSpec)) {
      return yield* invalidDefinition;
    }
    return responseSpec;
  }

  const correctCount = responseSpec.options.filter(
    ({ isCorrect }) => isCorrect
  ).length;
  if (
    responseSpec.options.length === 0 ||
    !hasUniquePositiveIdentity(
      responseSpec.options,
      ({ optionKey }) => optionKey
    ) ||
    responseSpec.options.some(({ label }) => !hasValidLabel(label)) ||
    (responseSpec.kind === "single-choice"
      ? correctCount !== 1
      : correctCount < 2 || correctCount === responseSpec.options.length)
  ) {
    return yield* invalidDefinition;
  }
  return responseSpec;
});

function hasValidCategoryDefinition(
  responseSpec: Extract<TryoutResponseSpec, { kind: "category" }>
) {
  const categoryKeys = new Set(
    responseSpec.categories.map(({ categoryKey }) => categoryKey)
  );
  return (
    responseSpec.categories.length >= 2 &&
    responseSpec.statements.length > 0 &&
    hasUniquePositiveIdentity(
      responseSpec.categories,
      ({ categoryKey }) => categoryKey
    ) &&
    hasUniquePositiveIdentity(
      responseSpec.statements,
      ({ statementKey }) => statementKey
    ) &&
    responseSpec.categories.every(({ label }) => hasValidLabel(label)) &&
    responseSpec.statements.every(
      ({ correctCategoryKey, label }) =>
        categoryKeys.has(correctCategoryKey) && hasValidLabel(label)
    )
  );
}

function hasUniquePositiveIdentity<Row extends { readonly order: number }>(
  rows: readonly Row[],
  readKey: (row: Row) => string
) {
  return (
    new Set(rows.map(readKey)).size === rows.length &&
    new Set(rows.map(({ order }) => order)).size === rows.length &&
    rows.every(({ order }) => Number.isSafeInteger(order) && order > 0)
  );
}

function hasValidLabel(label: string) {
  return label.length > 0;
}

const invalidDefinition = new TryoutResponseDefinitionError({
  message: "Try-out response definition violates its frozen invariants.",
});
