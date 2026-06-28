/** Formats one unknown error into a readable label. */
export function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return `${error.constructor.name}: ${error.message}`;
  }

  return String(error);
}
