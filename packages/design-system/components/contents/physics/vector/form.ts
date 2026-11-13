import { Array as Arr } from "effect";

/** The unit vectors along x, y and z, as KaTeX. */
export const UNIT_VECTORS = [
  "\\hat{\\imath}",
  "\\hat{\\jmath}",
  "\\hat{k}",
] as const;

/**
 * Writes a vector as a sum of unit vectors in KaTeX, such as
 * "\left(3\,\hat{\imath}-4\,\hat{\jmath}\right)\text{ m}": each component
 * through `format`, which writes the reader's decimals, a zero component
 * left out, and the zero vector as "\vec{0}".
 */
export function unitForm(
  components: readonly number[],
  format: (value: number) => string,
  unit: string
) {
  const terms = Arr.flatMap(components, (value, index) =>
    Math.abs(value) < 1e-9
      ? []
      : [{ term: `${format(Math.abs(value))}\\,${UNIT_VECTORS[index]}`, value }]
  );
  if (!Arr.isArrayNonEmpty(terms)) {
    return "\\vec{0}";
  }
  const sum = Arr.join(
    Arr.map(terms, ({ term, value }, index) => {
      if (value < 0) {
        return `-${term}`;
      }
      return index === 0 ? term : `+${term}`;
    }),
    ""
  );
  return terms.length === 1 ? `${sum}${unit}` : `\\left(${sum}\\right)${unit}`;
}
