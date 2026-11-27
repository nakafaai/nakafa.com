import type { BoxSheet } from "@repo/design-system/components/contents/mathematics/optimize/model";
import {
  deepestCut,
  evaluateOptimizationBox,
} from "@repo/design-system/components/contents/mathematics/optimize/model";
import { useCalculusColors } from "@repo/design-system/components/contents/mathematics/palette";
import {
  TraceChart,
  TraceCursor,
  TracePoint,
} from "@repo/design-system/components/contents/simulation/trace";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { Array as Arr } from "effect";
import { useMemo } from "react";

/** How many points the volume curve is drawn through. */
const STEPS = 72;
/** The least cut the model folds a box from. */
const LEAST_CUT = 0.1;
/** The step of the volume axis, which the axis ends on a multiple of above the greatest volume. */
const VOLUME_STEP = 10;

/**
 * The volume of the box against the depth of its corner cut, under the box
 * itself: the curve of the sheet, the cut that makes the volume greatest, and
 * the cut the scene shows now.
 */
export function VolumeTrace({
  cutLabel,
  cutout,
  curveLabel,
  optimalLabel,
  sheet,
}: {
  readonly cutLabel: string;
  readonly cutout: number;
  readonly curveLabel: string;
  readonly optimalLabel: string;
  readonly sheet: BoxSheet;
}) {
  const colors = useCalculusColors();
  const deepest = deepestCut(sheet);
  const data = useMemo(
    () =>
      Arr.makeBy(STEPS + 1, (index) => {
        // No cut folds no box. Every other point is a cut the model takes, from its least one up.
        if (index === 0) {
          return { cut: 0, volume: 0 };
        }
        const cut =
          LEAST_CUT + ((deepest - LEAST_CUT) * (index - 1)) / (STEPS - 1);
        return { cut, volume: evaluateOptimizationBox(sheet, cut).volume };
      }),
    [deepest, sheet]
  );
  const now = evaluateOptimizationBox(sheet, cutout);
  const best = evaluateOptimizationBox(sheet, now.optimalCut);

  return (
    <TraceChart
      data={data}
      marks={[{ color: colors.slope, kind: "point", label: optimalLabel }]}
      series={[{ color: colors.curve, key: "volume", label: curveLabel }]}
      x={{
        domain: [0, Math.ceil(deepest)],
        key: "cut",
        label: cutLabel,
        ticks: Arr.makeBy(Math.ceil(deepest) * 2 + 1, (index) => index / 2),
      }}
      y={{
        domain: [0, Math.ceil(best.volume / VOLUME_STEP) * VOLUME_STEP],
        label: <InlineMath math="V(x)" />,
      }}
    >
      <TraceCursor x={cutout} />
      <TracePoint color={colors.slope} x={now.optimalCut} y={best.volume} />
      <TracePoint color={colors.accent} x={cutout} y={now.volume} />
    </TraceChart>
  );
}
