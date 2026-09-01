/** Stable DOM identifier for one response option label. */
export function optionLabelId(responseId: string, optionKey: string) {
  return `${responseId}-${optionKey}`;
}

/** Stable DOM identifier for one category statement label. */
export function statementLabelId(responseId: string, statementKey: string) {
  return `${responseId}-${statementKey}`;
}

/** Stable DOM identifier for one category choice label. */
export function categoryLabelId(
  responseId: string,
  statementKey: string,
  categoryKey: string
) {
  return `${statementLabelId(responseId, statementKey)}-${categoryKey}`;
}
