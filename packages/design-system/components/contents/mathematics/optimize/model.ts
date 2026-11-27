import { Schema } from "effect";

const BoxSheetSchema = Schema.Literals([
  "squareSheet",
  "wideSheet",
  "tallSheet",
]);

export type BoxSheet = typeof BoxSheetSchema.Type;

/** The length and the width of each sheet before its corners are cut. */
export const BOX_SHEETS = {
  squareSheet: { length: 6, width: 6 },
  tallSheet: { length: 10, width: 6 },
  wideSheet: { length: 8, width: 6 },
} as const;

/** The share of a sheet's shorter side the deepest corner cut takes, just short of the half that leaves no base. */
const DEEPEST_CUT = 0.48;

/** The deepest corner cut a sheet takes before its base closes. */
export function deepestCut(sheet: BoxSheet) {
  const { length, width } = BOX_SHEETS[sheet];
  return Math.min(length, width) * DEEPEST_CUT;
}

const BoxMetricsSchema = Schema.Struct({
  baseLength: Schema.Finite,
  baseWidth: Schema.Finite,
  derivative: Schema.Finite,
  optimalCut: Schema.Finite,
  volume: Schema.Finite,
});

/** Compute open-top folded box dimensions, volume V(x), V'(x), and optimal corner cut x*. */
export function evaluateOptimizationBox(
  sheet: BoxSheet,
  cutout: number
): typeof BoxMetricsSchema.Type {
  const { length, width } = BOX_SHEETS[sheet];
  const x = Math.min(deepestCut(sheet), Math.max(0.1, cutout));
  const baseLength = Math.max(0.1, length - 2 * x);
  const baseWidth = Math.max(0.1, width - 2 * x);
  const volume = x * baseLength * baseWidth;
  const derivative = length * width - 4 * (length + width) * x + 12 * x * x;
  const disc = Math.sqrt(
    (length + width) * (length + width) - 3 * length * width
  );
  const optimalCut = (length + width - disc) / 6;

  return {
    baseLength: Number(baseLength.toFixed(2)),
    baseWidth: Number(baseWidth.toFixed(2)),
    derivative: Number(derivative.toFixed(2)),
    optimalCut: Number(optimalCut.toFixed(2)),
    volume: Number(volume.toFixed(2)),
  };
}
