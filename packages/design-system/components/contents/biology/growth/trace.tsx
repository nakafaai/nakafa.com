import type { PlantLifeCycle } from "@repo/design-system/components/contents/biology/growth/model";
import {
  evaluateGrowthCurve,
  sampleGrowthCurve,
} from "@repo/design-system/components/contents/biology/growth/model";
import {
  TraceChart,
  TraceCursor,
  TracePoint,
} from "@repo/design-system/components/contents/simulation/trace";
import { FOLIAGE_COLORS } from "@repo/design-system/lib/material/foliage";
import { Array as Arr } from "effect";
import type { ReactNode } from "react";
import { useMemo } from "react";

/** How many points the growth curve is drawn through. */
const STEPS = 80;

/** The dry mass of the plant over its life cycle, with a cursor and a point at the time the scene shows. */
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
  const data = useMemo(
    () =>
      Arr.map(sampleGrowthCurve(lifeCycle, STEPS), (point) => ({
        mass: point.dryMass,
        time: point.time,
      })),
    [lifeCycle]
  );
  const current = evaluateGrowthCurve(lifeCycle, time);

  return (
    <TraceChart
      data={data}
      series={[
        { color: FOLIAGE_COLORS.palisade, key: "mass", label: dryMassLabel },
      ]}
      x={{
        domain: [0, 100],
        key: "time",
        label: timeLabel,
        ticks: [0, 25, 50, 75, 100],
      }}
      y={{ domain: [0, 1], ticks: [0, 0.5, 1] }}
    >
      <TraceCursor x={current.time} />
      <TracePoint
        color={FOLIAGE_COLORS.palisade}
        x={current.time}
        y={Math.min(1, Math.max(0, current.dryMass))}
      />
    </TraceChart>
  );
}
