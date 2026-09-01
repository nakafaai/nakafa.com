import type { QuestionResponse } from "@nakafa/aksara-contracts/question/response";
import type { TryoutResponseSelection } from "@/components/tryout/runtime/response/state";

/** Reports whether one authored preview selection is complete and valid. */
export function isPreviewComplete(
  responseSpec: QuestionResponse,
  selection: TryoutResponseSelection | null
) {
  if (!selection) {
    return false;
  }
  if (responseSpec.kind === "single-choice") {
    if (selection.kind !== responseSpec.kind) {
      return false;
    }
    return responseSpec.options.some(
      ({ optionKey }) => optionKey === selection.optionKey
    );
  }
  if (responseSpec.kind === "multiple-choice") {
    if (selection.kind !== responseSpec.kind) {
      return false;
    }
    const available = new Set(
      responseSpec.options.map(({ optionKey }) => optionKey)
    );
    const selected = new Set(selection.optionKeys);
    return (
      selected.size > 0 &&
      selected.size === selection.optionKeys.length &&
      selection.optionKeys.every((optionKey) => available.has(optionKey))
    );
  }
  if (selection.kind !== responseSpec.kind) {
    return false;
  }
  const availableCategories = new Set(
    responseSpec.categories.map(({ categoryKey }) => categoryKey)
  );
  const availableStatements = new Set(
    responseSpec.statements.map(({ statementKey }) => statementKey)
  );
  const assignedStatements = new Set(
    selection.assignments.map(({ statementKey }) => statementKey)
  );
  return (
    selection.assignments.length === responseSpec.statements.length &&
    assignedStatements.size === selection.assignments.length &&
    selection.assignments.every(
      ({ categoryKey, statementKey }) =>
        availableCategories.has(categoryKey) &&
        availableStatements.has(statementKey)
    )
  );
}

/** Reports whether one complete authored preview selection matches its key. */
export function isPreviewCorrect(
  responseSpec: QuestionResponse,
  selection: TryoutResponseSelection | null
) {
  if (!selection) {
    return false;
  }
  if (responseSpec.kind === "single-choice") {
    if (selection.kind !== responseSpec.kind) {
      return false;
    }
    return (
      responseSpec.options.find(
        ({ optionKey }) => optionKey === selection.optionKey
      )?.isCorrect === true
    );
  }
  if (responseSpec.kind === "multiple-choice") {
    if (responseSpec.kind !== selection.kind) {
      return false;
    }
    if (!isPreviewComplete(responseSpec, selection)) {
      return false;
    }
    const selected = new Set(selection.optionKeys);
    return responseSpec.options.every(
      ({ isCorrect, optionKey }) => selected.has(optionKey) === isCorrect
    );
  }
  if (responseSpec.kind !== selection.kind) {
    return false;
  }
  if (!isPreviewComplete(responseSpec, selection)) {
    return false;
  }
  const assignments = new Map(
    selection.assignments.map(({ categoryKey, statementKey }) => [
      statementKey,
      categoryKey,
    ])
  );
  return responseSpec.statements.every(
    ({ correctCategoryKey, statementKey }) =>
      assignments.get(statementKey) === correctCategoryKey
  );
}
