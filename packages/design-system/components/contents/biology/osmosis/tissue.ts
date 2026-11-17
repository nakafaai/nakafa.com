import { Array as Arr, Option, Order, Schema } from "effect";

/**
 * One tube of the osmosis series: the sucrose concentration in moles per
 * cubic decimetre, and the percentage change in mass of the tissue strip
 * soaked in it.
 */
const StripSchema = Schema.Struct({
  change: Schema.Finite,
  concentration: Schema.Finite,
});
export type Strip = typeof StripSchema.Type;

/** The mass of a strip that started at `mass` grams after it changed by `change` per cent. */
export function massAfter(mass: number, change: number) {
  return mass * (1 + change / 100);
}

/**
 * How long a strip that started `length` long has become: its cells swell or
 * shrink mostly along the strip, so its length follows its mass.
 */
export function lengthAfter(length: number, change: number) {
  return length * (1 + change / 100);
}

/**
 * The concentration isotonic with the cell sap: where the mass change crosses
 * zero between two neighbouring tubes, taking the change as linear between
 * them. None when every strip gains or every strip loses.
 */
export function isotonicPoint(strips: readonly Strip[]) {
  const sorted = Arr.sort(strips, BY_CONCENTRATION);
  return Arr.findFirst(
    Arr.zip(sorted, Arr.drop(sorted, 1)),
    ([low, high]) => low.change >= 0 && high.change <= 0
  ).pipe(
    Option.map(([low, high]) =>
      low.change === high.change
        ? low.concentration
        : low.concentration +
          ((high.concentration - low.concentration) * low.change) /
            (low.change - high.change)
    )
  );
}

/** Orders strips by rising concentration. */
const BY_CONCENTRATION = Order.mapInput(
  Order.Number,
  (strip: Strip) => strip.concentration
);

/**
 * The percentage change in mass at `concentration`, taking the change as
 * linear between the two neighbouring tubes, and as the end tube's change
 * beyond the series.
 */
export function changeAt(
  strips: readonly [Strip, ...Strip[]],
  concentration: number
) {
  const sorted = Arr.sort(strips, BY_CONCENTRATION);
  const first = Arr.headNonEmpty(sorted);
  const last = Arr.lastNonEmpty(sorted);
  if (concentration <= first.concentration) {
    return first.change;
  }
  if (concentration >= last.concentration) {
    return last.change;
  }
  return Arr.reduce(
    Arr.zip(sorted, Arr.drop(sorted, 1)),
    last.change,
    (value, [low, high]) =>
      concentration > low.concentration && concentration <= high.concentration
        ? low.change +
          ((high.change - low.change) * (concentration - low.concentration)) /
            (high.concentration - low.concentration)
        : value
  );
}

/**
 * How far a cell's protoplast fills its wall, from 0 to 1, for a tissue whose
 * mass changed by `change` per cent: in a hypotonic solution it presses on
 * the wall, which stops it swelling further; in a hypertonic one it loses
 * water and pulls away from the wall in plasmolysis.
 */
export function protoplastFill(change: number) {
  return change >= 0 ? 1 : Math.max(0.45, 1 + change / 25);
}

/** Whether the solution of a strip is hypotonic, isotonic, or hypertonic to the cell sap. */
export function tonicity(change: number) {
  if (change > 0) {
    return "hypotonic";
  }
  return change < 0 ? "hypertonic" : "isotonic";
}
