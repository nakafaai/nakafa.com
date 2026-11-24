import type { PlantLifeCycle } from "@repo/design-system/components/contents/biology/growth/model";
import {
  evaluateGrowthCurve,
  sampleGrowthCurve,
} from "@repo/design-system/components/contents/biology/growth/model";
import { FOLIAGE_COLORS } from "@repo/design-system/lib/material/foliage";
import { Array as Arr } from "effect";
import type { ReactNode } from "react";
import { useMemo } from "react";

const WIDTH = 200;
const HEIGHT = 88;

function xOf(time: number): number {
  return (time / 100) * WIDTH;
}

function yOf(dryMass: number): number {
  return HEIGHT - Math.min(1, Math.max(0, dryMass)) * HEIGHT;
}

export function PlantGrowthTrace({
  dryMassLabel,
  lifeCycle,
  time,
  timeLabel,
}: {
  readonly dryMassLabel: ReactNode;
  readonly lifeCycle: PlantLifeCycle;
  readonly time: number;
  readonly timeLabel: string;
}) {
  const samples = useMemo(() => sampleGrowthCurve(lifeCycle, 44), [lifeCycle]);
  const current = evaluateGrowthCurve(lifeCycle, time);
  const points = useMemo(
    () =>
      Arr.join(
        Arr.map(samples, (pt) => `${xOf(pt.time)},${yOf(pt.dryMass)}`),
        " "
      ),
    [samples]
  );

  return (
    <div className="flex flex-col gap-2">
      <div className="text-muted-foreground flex flex-wrap justify-between gap-x-4 text-xs">
        <span className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="size-2 rounded-full"
            style={{ backgroundColor: FOLIAGE_COLORS.palisade }}
          />
          {dryMassLabel}
        </span>
        <span>{timeLabel}</span>
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
              points={points}
              stroke={FOLIAGE_COLORS.palisade}
              strokeLinejoin="round"
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
            />
            <line
              className="stroke-foreground"
              strokeOpacity={0.4}
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
              x1={xOf(current.time)}
              x2={xOf(current.time)}
              y1={0}
              y2={HEIGHT}
            />
          </svg>
        </div>
      </div>
    </div>
  );
}
