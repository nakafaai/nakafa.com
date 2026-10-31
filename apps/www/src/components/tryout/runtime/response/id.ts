/** Stable DOM identifier for one response option label. */
export function optionLabelId(responseId: string, optionKey: string) {
  return `${responseId}-${optionKey}`;
}
