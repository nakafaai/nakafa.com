/**
 * Helper to safely construct objects with required fields
 */
export function buildRequiredObject<T extends Record<string, unknown>>(
  obj: T
): { [K in keyof T]-?: Exclude<T[K], undefined> } {
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) {
      throw new Error(`Required field '${key}' is undefined`);
    }
  }
  return obj as { [K in keyof T]-?: Exclude<T[K], undefined> };
}

/**
 * Type predicate to check if value is not undefined
 */
export function isNotUndefined<T>(value: T): value is Exclude<T, undefined> {
  return value !== undefined;
}
