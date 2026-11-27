import {
  demand,
  RUN,
  trace,
  uptake,
} from "@repo/design-system/components/contents/biology/muscle/debt";
import {
  TraceChart,
  TraceCursor,
  TraceFill,
  TracePoint,
} from "@repo/design-system/components/contents/simulation/trace";
import { MUSCLE_COLORS } from "@repo/design-system/lib/material/muscle";
import { Array as Arr } from "effect";
import type { ReactNode } from "react";
import { useMemo } from "react";

/** The minutes the time axis marks. */
const MINUTES = [0, 4, 8, 12, 16] as const;

/** How many points the uptake curve is drawn through. */
const STEPS = 160;

/**
 * The run's oxygen uptake against time, as a live record under the scene:
 * the demand as a dashed line, the uptake as a solid one, the shortfall
 * during exercise shaded amber like the lactic acid that covers it, the debt
 * after it shaded blue like the oxygen that repays it, and a cursor with a
 * point at the minute the scene shows, captioned by its two axes.
 */
export function OxygenTrace({
  caption,
  clock,
  minute,
  most,
  rest,
  work,
}: {
  readonly caption: ReactNode;
  readonly clock: ReactNode;
  readonly minute: number;
  readonly most: number;
  readonly rest: number;
  readonly work: number;
}) {
  const top = Math.ceil(rest + most);
  const data = useMemo(
    () =>
      Arr.map(trace(rest, work, STEPS), (point) => {
        const need = demand(point.minute, rest, work);
        const exercising = point.minute >= RUN.start && point.minute <= RUN.end;
        return {
          debt:
            point.minute >= RUN.end ? ([rest, point.uptake] as const) : null,
          demand: need,
          minute: point.minute,
          shortfall: exercising ? ([point.uptake, rest + work] as const) : null,
          uptake: point.uptake,
        };
      }),
    [rest, work]
  );

  return (
    <TraceChart
      data={data}
      series={[
        {
          color: "var(--muted-foreground)",
          curve: "stepAfter",
          dashed: true,
          key: "demand",
          width: 1.75,
        },
        { color: MUSCLE_COLORS.oxygen, key: "uptake" },
      ]}
      x={{
        domain: [0, RUN.close],
        key: "minute",
        label: clock,
        ticks: MINUTES,
      }}
      y={{ domain: [0, top], label: caption, ticks: Arr.range(0, top) }}
    >
      <TraceFill
        color={MUSCLE_COLORS.lactate}
        dataKey="shortfall"
        opacity={0.4}
      />
      <TraceFill color={MUSCLE_COLORS.oxygen} dataKey="debt" opacity={0.24} />
      <TraceCursor x={minute} />
      <TracePoint
        color={MUSCLE_COLORS.oxygen}
        x={minute}
        y={uptake(minute, rest, work)}
      />
    </TraceChart>
  );
}

/**
 * The lactic acid gauge of a readout: a bar that fills amber from 0 to the
 * lab's most lactic acid, beside the reading itself.
 */
export function LacticGauge({
  children,
  level,
}: {
  readonly children: ReactNode;
  readonly level: number;
}) {
  return (
    <span className="flex items-center gap-3">
      <span className="bg-muted h-2 w-20 shrink-0 overflow-hidden rounded-full">
        <span
          className="block h-full rounded-full"
          style={{
            backgroundColor: MUSCLE_COLORS.lactate,
            width: `${Math.round(level * 100)}%`,
          }}
        />
      </span>
      {children}
    </span>
  );
}
