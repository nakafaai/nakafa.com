import { saturationCurve } from "@repo/design-system/components/contents/biology/saturation/model";
import {
  TraceChart,
  TracePoint,
} from "@repo/design-system/components/contents/simulation/trace";
import { ENZYME_COLORS } from "@repo/design-system/lib/material/enzyme";
import { Array as Arr } from "effect";
import type { ReactNode } from "react";

/** How many points the saturation curve is drawn through. */
const STEPS = 64;

/**
 * The reaction rate against the substrate count, rising and then levelling at
 * the plateau the enzymes set, with a point at the lab's own substrate count.
 */
export function SaturationTrace({
  caption,
  currentRate,
  currentSubstrates,
  enzymes,
  maxRate,
  maxSubstrates,
  turnover,
}: {
  readonly caption: ReactNode;
  readonly currentRate: number;
  readonly currentSubstrates: number;
  readonly enzymes: number;
  readonly maxRate: number;
  readonly maxSubstrates: number;
  readonly turnover: number;
}) {
  const safeSubstrates = Math.max(1, maxSubstrates);
  const safeRate = Math.max(1, maxRate);
  const data = Arr.map(
    saturationCurve(enzymes, safeSubstrates, turnover, STEPS),
    (point) => ({ rate: point.rate, substrates: point.substrates })
  );

  return (
    <TraceChart
      data={data}
      series={[{ color: ENZYME_COLORS.curveStroke, key: "rate" }]}
      x={{ domain: [0, safeSubstrates], key: "substrates" }}
      y={{ domain: [0, safeRate], label: caption }}
    >
      <TracePoint
        color={ENZYME_COLORS.curveCursor}
        x={currentSubstrates}
        y={currentRate}
      />
    </TraceChart>
  );
}
