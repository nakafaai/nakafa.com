import { Match, Schema } from "effect";

const BoxSheetSchema = Schema.Literals([
  "squareSheet",
  "wideSheet",
  "tallSheet",
]);

export type BoxSheet = typeof BoxSheetSchema.Type;

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
  const [length, width] = Match.value(sheet).pipe(
    Match.when("squareSheet", () => [6, 6] as const),
    Match.when("wideSheet", () => [8, 6] as const),
    Match.when("tallSheet", () => [10, 6] as const),
    Match.exhaustive
  );
  const maxCut = Math.min(length, width) * 0.48;
  const x = Math.min(maxCut, Math.max(0.1, cutout));
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
