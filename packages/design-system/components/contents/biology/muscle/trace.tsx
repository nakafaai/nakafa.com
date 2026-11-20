import {
  RUN,
  trace,
  uptake,
} from "@repo/design-system/components/contents/biology/muscle/debt";
import { MUSCLE_COLORS } from "@repo/design-system/lib/material/muscle";
import { Array as Arr } from "effect";
import type { ReactNode } from "react";

/** The minutes the time axis marks. */
const MINUTES = [0, 4, 8, 12, 16] as const;

/** How many points the uptake curve is drawn through. */
const STEPS = 128;

/** How many drawing units a minute and a litre a minute take in the plot's own coordinates. */
const SCALE = 10;

/**
 * The run's oxygen uptake against time, as a small live record under the
 * scene: the demand as a dashed line, the uptake as a solid one, the
 * shortfall during exercise shaded amber like the lactic acid that covers
 * it, the debt after it shaded blue like the oxygen that repays it, and a
 * cursor at the minute the scene shows, captioned by its two axes. The plot stretches to the card's
 * width while its lines and text keep their size, so it reads on a phone.
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
  const x = (value: number) => value * SCALE;
  const y = (value: number) => (top - value) * SCALE;
  const points = trace(rest, work, STEPS);
  const line = (from: number, to: number) =>
    Arr.map(
      Arr.filter(points, (point) => point.minute >= from && point.minute <= to),
      (point) => `${x(point.minute)},${y(point.uptake)}`
    );
  const exercise = [
    `${x(RUN.start)},${y(rest + work)}`,
    `${x(RUN.end)},${y(rest + work)}`,
    ...Arr.reverse(line(RUN.start, RUN.end)),
  ];
  const recovery = [
    `${x(RUN.end)},${y(rest)}`,
    ...line(RUN.end, RUN.close),
    `${x(RUN.close)},${y(rest)}`,
  ];
  const demand = [
    `${x(0)},${y(rest)}`,
    `${x(RUN.start)},${y(rest)}`,
    `${x(RUN.start)},${y(rest + work)}`,
    `${x(RUN.end)},${y(rest + work)}`,
    `${x(RUN.end)},${y(rest)}`,
    `${x(RUN.close)},${y(rest)}`,
  ];
  const across = (value: number) => `${(value / RUN.close) * 100}%`;
  const down = (value: number) => `${(1 - value / top) * 100}%`;

  return (
    <div className="flex flex-col gap-2">
      <div className="text-muted-foreground flex flex-wrap justify-between gap-x-4 text-sm">
        <span>{caption}</span>
        <span>{clock}</span>
      </div>
      <div className="relative h-40 ps-6 pe-2 pb-6">
        <div className="relative h-full">
          {Arr.map(Arr.range(0, top), (level) => (
            <div
              className="border-border absolute inset-x-0 border-t"
              key={level}
              style={{ top: down(level) }}
            >
              <span className="text-muted-foreground absolute -start-6 w-4 -translate-y-1/2 text-end text-xs tabular-nums">
                {level}
              </span>
            </div>
          ))}
          {Arr.map(MINUTES, (mark) => (
            <span
              className="text-muted-foreground absolute top-full mt-1 -translate-x-1/2 text-xs whitespace-nowrap tabular-nums"
              key={mark}
              style={{ left: across(mark) }}
            >
              {mark}
            </span>
          ))}
          <svg
            aria-hidden="true"
            className="absolute inset-0 size-full overflow-visible"
            preserveAspectRatio="none"
            viewBox={`0 0 ${x(RUN.close)} ${y(0)}`}
          >
            <polygon
              fill={MUSCLE_COLORS.lactate}
              fillOpacity={0.4}
              points={Arr.join(exercise, " ")}
            />
            <polygon
              fill={MUSCLE_COLORS.oxygen}
              fillOpacity={0.24}
              points={Arr.join(recovery, " ")}
            />
            <polyline
              className="stroke-muted-foreground"
              fill="none"
              points={Arr.join(demand, " ")}
              strokeDasharray="5 4"
              strokeWidth={1.5}
              vectorEffect="non-scaling-stroke"
            />
            <polyline
              fill="none"
              points={Arr.join(line(0, RUN.close), " ")}
              stroke={MUSCLE_COLORS.oxygen}
              strokeLinejoin="round"
              strokeWidth={2.25}
              vectorEffect="non-scaling-stroke"
            />
            <line
              className="stroke-foreground"
              strokeOpacity={0.45}
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
              x1={x(minute)}
              x2={x(minute)}
              y1={0}
              y2={y(0)}
            />
          </svg>
          <span
            className="border-background absolute size-3 -translate-1/2 rounded-full border-2"
            style={{
              backgroundColor: MUSCLE_COLORS.oxygen,
              left: across(minute),
              top: down(uptake(minute, rest, work)),
            }}
          />
        </div>
      </div>
    </div>
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
