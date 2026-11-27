import {
  MAX_SIMULATION_TIME,
  sampleRateCurves,
} from "@repo/design-system/components/contents/chemistry/equilibrium/model";
import {
  TraceChart,
  TraceCursor,
} from "@repo/design-system/components/contents/simulation/trace";
import { EQUILIBRIUM_COLORS } from "@repo/design-system/lib/material/equilibrium";
import { Array as Arr } from "effect";
import type { ReactNode } from "react";
import { useMemo } from "react";

/** How many points each rate curve is drawn through. */
const STEPS = 64;

/** The forward and the reverse rate against time, meeting at equilibrium, with a cursor at the scene's moment. */
export function RateConvergenceTrace({
  elapsed,
  forwardLabel,
  initialReactant,
  kf,
  kr,
  reverseLabel,
}: {
  readonly elapsed: number;
  readonly forwardLabel: ReactNode;
  readonly initialReactant: number;
  readonly kf: number;
  readonly kr: number;
  readonly reverseLabel: ReactNode;
}) {
  const data = useMemo(
    () =>
      Arr.map(sampleRateCurves(initialReactant, kf, kr, STEPS), (point) => ({
        forward: point.forward,
        reverse: point.reverse,
        time: point.time,
      })),
    [initialReactant, kf, kr]
  );
  const maxRate = Math.max(0.2, kf * initialReactant * 1.1);

  return (
    <TraceChart
      data={data}
      series={[
        {
          color: EQUILIBRIUM_COLORS.forwardArrow,
          key: "forward",
          label: forwardLabel,
        },
        {
          color: EQUILIBRIUM_COLORS.reverseArrow,
          key: "reverse",
          label: reverseLabel,
        },
      ]}
      x={{ domain: [0, MAX_SIMULATION_TIME], key: "time" }}
      y={{ domain: [0, maxRate] }}
    >
      <TraceCursor x={elapsed} />
    </TraceChart>
  );
}
