import {
  MAX_SIMULATION_TIME,
  sampleRateCurves,
} from "@repo/design-system/components/contents/chemistry/equilibrium/model";
import { EQUILIBRIUM_COLORS } from "@repo/design-system/lib/material/equilibrium";
import { Array as Arr } from "effect";
import type { ReactNode } from "react";

const WIDTH = 200;
const HEIGHT = 88;

/** Live rate-convergence plot showing forward and reverse rates meeting at equilibrium. */
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
  const samples = sampleRateCurves(initialReactant, kf, kr, 32);
  const maxRate = Math.max(0.2, kf * initialReactant * 1.1);
  const xOf = (time: number) => (time / MAX_SIMULATION_TIME) * WIDTH;
  const yOf = (rate: number) => HEIGHT - (rate / maxRate) * HEIGHT;
  const forwardLine = Arr.join(
    Arr.map(samples, (pt) => `${xOf(pt.time)},${yOf(pt.forward)}`),
    " "
  );
  const reverseLine = Arr.join(
    Arr.map(samples, (pt) => `${xOf(pt.time)},${yOf(pt.reverse)}`),
    " "
  );

  return (
    <div className="flex flex-col gap-2">
      <div className="text-muted-foreground flex flex-wrap justify-between gap-x-4 text-xs">
        <span className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="size-2 rounded-full"
            style={{ backgroundColor: EQUILIBRIUM_COLORS.forwardArrow }}
          />
          {forwardLabel}
        </span>
        <span className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="size-2 rounded-full"
            style={{ backgroundColor: EQUILIBRIUM_COLORS.reverseArrow }}
          />
          {reverseLabel}
        </span>
      </div>
      <div className="relative h-24 px-1 pb-1">
        <div className="border-border relative h-full border-s border-b">
          <svg
            aria-hidden="true"
            className="absolute inset-0 size-full overflow-visible"
            preserveAspectRatio="none"
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          >
            <polyline
              fill="none"
              points={forwardLine}
              stroke={EQUILIBRIUM_COLORS.forwardArrow}
              strokeLinejoin="round"
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
            />
            <polyline
              fill="none"
              points={reverseLine}
              stroke={EQUILIBRIUM_COLORS.reverseArrow}
              strokeLinejoin="round"
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
            />
            <line
              className="stroke-foreground"
              strokeOpacity={0.4}
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
              x1={xOf(elapsed)}
              x2={xOf(elapsed)}
              y1={0}
              y2={HEIGHT}
            />
          </svg>
        </div>
      </div>
    </div>
  );
}
