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
