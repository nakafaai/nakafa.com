/**
 * Safely constructs an object with all required fields.
 * Throws an error if any field is undefined.
 *
 * @param obj - The object to check
 * @returns The same object with `undefined` types removed from values
 * @throws Error if any value is undefined
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
 * Type predicate to filter out undefined values.
 * Useful in `Array.filter()`.
 *
 * @example
 * const items = [1, undefined, 2].filter(isNotUndefined); // [1, 2]
 */
export function isNotUndefined<T>(value: T): value is Exclude<T, undefined> {
  return value !== undefined;
}
