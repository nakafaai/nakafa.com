import type {
  TryoutResponseSelection,
  TryoutResponseSpec,
  TryoutRuntimeResponseSpec,
} from "@repo/backend/convex/tryouts/response/model";

type TryoutResponseKind = TryoutRuntimeResponseSpec["kind"];

type ReadonlyResponseSpecFor<
  ResponseSpec extends TryoutRuntimeResponseSpec,
  Kind extends TryoutResponseKind,
> = {
  readonly [Key in keyof Extract<
    ResponseSpec,
    { readonly kind: Kind }
  >]: Extract<
    ResponseSpec,
    { readonly kind: Kind }
  >[Key] extends readonly (infer Item)[]
    ? readonly Readonly<Item>[]
    : Extract<ResponseSpec, { readonly kind: Kind }>[Key];
};

type TryoutResponseDefinition = {
  [Kind in TryoutResponseKind]: ReadonlyResponseSpecFor<
    TryoutRuntimeResponseSpec,
    Kind
  >;
}[TryoutResponseKind];

type TryoutResponseAnswerKey = {
  [Kind in TryoutResponseKind]: ReadonlyResponseSpecFor<
    TryoutResponseSpec,
    Kind
  >;
}[TryoutResponseKind];

type ResponseSpecFor<Kind extends TryoutResponseKind> = Extract<
  TryoutResponseDefinition,
  { readonly kind: Kind }
>;

type ResponseSelectionFor<Kind extends TryoutResponseKind> = Extract<
  TryoutResponseSelection,
  { readonly kind: Kind }
>;

interface InvalidTryoutResponseSelection {
  readonly reason: "kind-mismatch" | "selection-invalid";
  readonly valid: false;
}

type ValidTryoutResponseSelection<
  ResponseSpec extends TryoutResponseDefinition,
> = {
  [Kind in TryoutResponseKind]: ResponseSpec extends ResponseSpecFor<Kind>
    ? {
        readonly isComplete: Kind extends "category" ? boolean : true;
        readonly kind: Kind;
        readonly responseSpec: ResponseSpec;
        readonly selection: ResponseSelectionFor<Kind>;
        readonly valid: true;
      }
    : never;
}[TryoutResponseKind];

type TryoutResponseSelectionValidation<
  ResponseSpec extends TryoutResponseDefinition,
> = InvalidTryoutResponseSelection | ValidTryoutResponseSelection<ResponseSpec>;

const kindMismatch = {
  reason: "kind-mismatch",
  valid: false,
} as const;

const selectionInvalid = {
  reason: "selection-invalid",
  valid: false,
} as const;

/** Validates and canonically orders one learner response selection. */
export function validateTryoutResponseSelection<
  const ResponseSpec extends TryoutResponseDefinition,
>(
  responseSpec: ResponseSpec,
  selection: TryoutResponseSelection
): TryoutResponseSelectionValidation<ResponseSpec>;
export function validateTryoutResponseSelection(
  responseSpec: TryoutResponseDefinition,
  selection: TryoutResponseSelection
): TryoutResponseSelectionValidation<TryoutResponseDefinition> {
  if (selection.kind === "single-choice") {
    if (responseSpec.kind !== selection.kind) {
      return kindMismatch;
    }
    if (
      !responseSpec.options.some(
        ({ optionKey }) => optionKey === selection.optionKey
      )
    ) {
      return selectionInvalid;
    }
    return {
      isComplete: true,
      kind: selection.kind,
      responseSpec,
      selection: { kind: selection.kind, optionKey: selection.optionKey },
      valid: true,
    };
  }

  if (selection.kind === "multiple-choice") {
    if (responseSpec.kind !== selection.kind) {
      return kindMismatch;
    }
    const requested = new Set(selection.optionKeys);
    const available = new Set(
      responseSpec.options.map(({ optionKey }) => optionKey)
    );
    if (
      requested.size === 0 ||
      requested.size !== selection.optionKeys.length ||
      requested.size > available.size ||
      [...requested].some((optionKey) => !available.has(optionKey))
    ) {
      return selectionInvalid;
    }
    return {
      isComplete: true,
      kind: selection.kind,
      responseSpec,
      selection: {
        kind: selection.kind,
        optionKeys: responseSpec.options.flatMap(({ optionKey }) =>
          requested.has(optionKey) ? [optionKey] : []
        ),
      },
      valid: true,
    };
  }

  if (responseSpec.kind !== selection.kind) {
    return kindMismatch;
  }
  const availableCategories = new Set(
    responseSpec.categories.map(({ categoryKey }) => categoryKey)
  );
  const availableStatements = new Set(
    responseSpec.statements.map(({ statementKey }) => statementKey)
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
        !(
          availableCategories.has(categoryKey) &&
          availableStatements.has(statementKey)
        )
    )
  ) {
    return selectionInvalid;
  }
  const canonicalAssignments = responseSpec.statements.flatMap(
    ({ statementKey }) => {
      const assignment = assignments.get(statementKey);
      return assignment ? [assignment] : [];
    }
  );
  return {
    isComplete: canonicalAssignments.length === responseSpec.statements.length,
    kind: selection.kind,
    responseSpec,
    selection: { assignments: canonicalAssignments, kind: selection.kind },
    valid: true,
  };
}

/** Validates and scores one learner selection against a complete answer key. */
export function evaluateTryoutResponseSelection(
  responseSpec: TryoutResponseAnswerKey,
  selection: TryoutResponseSelection
) {
  const validated = validateTryoutResponseSelection(responseSpec, selection);
  if (!validated.valid) {
    return validated;
  }
  if (validated.kind === "single-choice") {
    return {
      ...validated,
      isCorrect: validated.responseSpec.options.some(
        ({ isCorrect, optionKey }) =>
          isCorrect && optionKey === validated.selection.optionKey
      ),
    };
  }
  if (validated.kind === "multiple-choice") {
    const selected = new Set(validated.selection.optionKeys);
    return {
      ...validated,
      isCorrect: validated.responseSpec.options.every(
        ({ isCorrect, optionKey }) => selected.has(optionKey) === isCorrect
      ),
    };
  }
  const assignments = new Map(
    validated.selection.assignments.map(({ categoryKey, statementKey }) => [
      statementKey,
      categoryKey,
    ])
  );
  return {
    ...validated,
    isCorrect:
      validated.isComplete &&
      validated.responseSpec.statements.every(
        ({ correctCategoryKey, statementKey }) =>
          assignments.get(statementKey) === correctCategoryKey
      ),
  };
}
