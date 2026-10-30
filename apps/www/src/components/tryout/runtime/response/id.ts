/** Stable DOM identifier for one response option label. */
export function optionLabelId(responseId: string, optionKey: string) {
  return `${responseId}-${optionKey}`;
}

/** Stable DOM identifier for one category statement label. */
export function statementLabelId(responseId: string, statementKey: string) {
  return `${responseId}-${statementKey}`;
}

/** Stable DOM identifier for one category's label, which heads its column of the table. */
export function categoryLabelId(responseId: string, categoryKey: string) {
  return `${responseId}-category-${categoryKey}`;
}
