/**
 * Preserves a non-empty string literal tuple for runtime schema constructors.
 *
 * Use this when a schema needs actual string values while TypeScript must keep
 * each member as its literal type instead of widening the list to `string[]`.
 */
export function literalValues<
  const Values extends readonly [string, ...string[]],
>(...values: Values): Values {
  return values;
}
