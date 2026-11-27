import type { Axes } from "@repo/design-system/components/contents/physics/thermodynamics/gas-process/diagram";
import {
  axisTicks,
  endAt,
  isothermStates,
  pathStates,
  SAMPLES,
} from "@repo/design-system/components/contents/physics/thermodynamics/gas-process/diagram";
import type {
  EndRange,
  GasProcess,
  GasState,
} from "@repo/design-system/components/contents/physics/thermodynamics/gas-process/gas";
import {
  TraceChart,
  TraceFill,
  TracePoint,
  TraceProbe,
} from "@repo/design-system/components/contents/simulation/trace";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { useVisual } from "@repo/design-system/components/visual/card";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Array as Arr } from "effect";
import type { ReactNode } from "react";
import { useMemo } from "react";

/** How close two temperatures lie, in kelvins, to share one isotherm. */
const SAME_TEMPERATURE = 1e-6;

/** The rows of a curve of the diagram, each state under the key of its curve. */
function rowsOf(states: readonly GasState[], key: string) {
  return Arr.map(states, (state) => ({
    [key]: state.pressure,
    volume: state.volume,
  }));
}

/**
 * The p-V diagram of the process, under the cylinder: the isotherms through
 * its two states as dashed curves, the whole path from state 1 to state 2 as
 * a thin line and the part the gas has run as a bold one, the band under
 * that part, whose area is the work W the gas has done, and the gas itself
 * as the point that runs along the path while the card plays. A press or a
 * drag on the plot sets where the process ends, as the slider does, and
 * takes over from a play.
 */
export function ProcessDiagram({
  axes,
  end,
  gamma,
  names,
  onEnd,
  process,
  range,
  share,
  start,
}: {
  readonly axes: Axes;
  readonly end: GasState;
  readonly gamma: number;
  readonly names: { readonly pressure: ReactNode; readonly volume: ReactNode };
  readonly onEnd: (value: number) => void;
  readonly process: GasProcess;
  readonly range: EndRange;
  /** How far along the process the gas is, 0 to 1. */
  readonly share: number;
  readonly start: GasState;
}) {
  const { playing, togglePlaying } = useVisual((state) => ({
    playing: state.playing,
    togglePlaying: state.togglePlaying,
  }));
  const whole = useMemo(
    () =>
      rowsOf(pathStates(process, { end, start }, gamma, SAMPLES, 1), "whole"),
    [end, gamma, process, start]
  );
  const run = useMemo(
    () => pathStates(process, { end, start }, gamma, SAMPLES, share),
    [end, gamma, process, share, start]
  );
  const isotherms = useMemo(
    () => ({
      first: rowsOf(isothermStates(start, axes, SAMPLES), "first"),
      second:
        Math.abs(end.temperature - start.temperature) < SAME_TEMPERATURE
          ? []
          : rowsOf(isothermStates(end, axes, SAMPLES), "second"),
    }),
    [axes, end, start]
  );
  const now = Arr.lastNonEmpty(Arr.prepend(run, start));

  return (
    <TraceChart
      data={[]}
      marks={[
        {
          color: "var(--muted-foreground)",
          kind: "dashed",
          label: <InlineMath math="T = \text{const}" />,
        },
        {
          color: PLOT_COLORS.teal,
          kind: "band",
          label: <InlineMath math="W" />,
        },
      ]}
      series={[
        {
          color: "var(--muted-foreground)",
          curve: "linear",
          dashed: true,
          data: isotherms.first,
          key: "first",
          width: 1.25,
        },
        {
          color: "var(--muted-foreground)",
          curve: "linear",
          dashed: true,
          data: isotherms.second,
          key: "second",
          width: 1.25,
        },
        {
          color: "var(--muted-foreground)",
          curve: "linear",
          data: whole,
          key: "whole",
          width: 1.5,
        },
        {
          color: "var(--foreground)",
          curve: "linear",
          data: rowsOf(run, "run"),
          key: "run",
          width: 3,
        },
      ]}
      tooltip={false}
      x={{
        domain: [0, axes.volume.maximum],
        key: "volume",
        label: names.volume,
        ticks: axisTicks(axes.volume),
      }}
      y={{
        domain: [0, axes.pressure.maximum],
        label: names.pressure,
        ticks: axisTicks(axes.pressure),
      }}
    >
      <TraceFill
        color={PLOT_COLORS.teal}
        data={rowsOf(run, "work")}
        dataKey="work"
        opacity={0.42}
      />
      <TracePoint
        color="var(--foreground)"
        name="1"
        x={start.volume}
        y={start.pressure}
      />
      <TracePoint
        color="var(--primary)"
        name="2"
        x={end.volume}
        y={end.pressure}
      />
      {share < 1 ? (
        <TracePoint
          color={PLOT_COLORS.orange}
          x={now.volume}
          y={now.pressure}
        />
      ) : null}
      <TraceProbe
        onSpot={(spot) => {
          if (playing) {
            togglePlaying();
          }
          onEnd(endAt(process, range, axes, spot));
        }}
      />
    </TraceChart>
  );
}
