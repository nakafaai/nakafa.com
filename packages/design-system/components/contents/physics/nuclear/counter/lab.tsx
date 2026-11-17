import { caption } from "@repo/design-system/components/contents/physics/canvas/caption";
import {
  dashed,
  fade,
  gradientRect,
  mix,
  vignette,
} from "@repo/design-system/components/contents/physics/canvas/paint";
import { paintBench } from "@repo/design-system/components/contents/physics/heat/glass";
import {
  halfLifeFromReadings,
  recordedRate,
} from "@repo/design-system/components/contents/physics/nuclear/decay";
import { useQuantity } from "@repo/design-system/components/contents/simulation/quantity";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import {
  VisualCard,
  VisualCardBody,
  VisualCardFacts,
  VisualCardFooter,
  VisualCardHeader,
} from "@repo/design-system/components/visual/card";
import { VisualFactTabular } from "@repo/design-system/components/visual/fact";
import { VisualCardSceneActions } from "@repo/design-system/components/visual/scene";
import { P5Sketch } from "@repo/design-system/components/visual/sketch";
import { getColor } from "@repo/design-system/lib/color";
import { BENCH_COLORS } from "@repo/design-system/lib/material/bench";
import { ENERGY_COLORS } from "@repo/design-system/lib/material/energy";
import { INSTRUMENT_COLORS } from "@repo/design-system/lib/material/instrument";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Array as Arr, Schema } from "effect";
import type p5 from "p5";
import type { ReactNode } from "react";

/** Wall seconds the clock takes to run from the first reading to the second. */
const PLAY_SECONDS = 6;

/** Wall seconds the last reading holds before the clock starts over. */
const HOLD_SECONDS = 2;

/** What the sketch reads on every frame. */
const CounterFrameSchema = Schema.Struct({
  background: Schema.Finite,
  halfLife: Schema.Finite,
  start: Schema.Finite,
  time: Schema.Finite,
});
type CounterFrame = typeof CounterFrameSchema.Type;

/**
 * Draws one moment: a Geiger-Muller tube on its stand aimed at the sample,
 * the counter's display showing the rate it records now, and below them the
 * recorded rate against time beside the sample's own rate, one background
 * apart, with the background dashed along the bottom.
 */
function counterProgram(sketch: p5, read: () => CounterFrame) {
  // The first frame is the finished state, so a paused card still shows the whole result.
  let clock = PLAY_SECONDS;
  sketch.setup = () => {
    sketch.createCanvas(1, 1);
  };
  sketch.draw = () => {
    const frame = read();
    if (sketch.isLooping()) {
      clock =
        (clock + Math.min(sketch.deltaTime / 1000, 0.1)) %
        (PLAY_SECONDS + HOLD_SECONDS);
    }
    const t = Math.min(clock / PLAY_SECONDS, 1) * frame.time;
    const { height, width } = sketch;
    const top = height * 0.42;
    paintBench(sketch, top);
    sketch.noStroke();
    sketch.fill(INSTRUMENT_COLORS.lead);
    sketch.rect(
      width * 0.08,
      top - height * 0.08,
      width * 0.12,
      height * 0.08,
      3
    );
    sketch.fill(ENERGY_COLORS.reactorGlow);
    sketch.circle(width * 0.14, top - height * 0.09, 10);
    gradientRect(
      sketch,
      {
        height: height * 0.05,
        width: width * 0.24,
        x: width * 0.24,
        y: top - height * 0.14,
      },
      [
        [0, mix(INSTRUMENT_COLORS.aluminium, getColor("WHITE"), 0.3)],
        [1, mix(INSTRUMENT_COLORS.aluminium, getColor("BLACK"), 0.4)],
      ]
    );
    sketch.fill(getColor("ZINC", 900));
    sketch.rect(
      width * 0.58,
      top - height * 0.3,
      width * 0.32,
      height * 0.22,
      8
    );
    sketch.fill(BENCH_COLORS.lcd);
    sketch.rect(
      width * 0.61,
      top - height * 0.26,
      width * 0.26,
      height * 0.1,
      4
    );
    const rate = recordedRate(frame, frame.background, t);
    caption(
      sketch,
      `${Math.round(rate)}`,
      { x: width * 0.85, y: top - height * 0.21 },
      {
        align: "right",
        baseline: "middle",
        color: BENCH_COLORS.lcdInk,
        size: Math.min(28, height * 0.07),
      }
    );
    const graph = {
      bottom: height * 0.92,
      left: width * 0.12,
      right: width * 0.92,
      top: height * 0.5,
    };
    const most = (frame.start + frame.background) * 1.08;
    const x = (time: number) =>
      graph.left + (time / frame.time) * (graph.right - graph.left);
    const y = (value: number) =>
      graph.bottom - (value / most) * (graph.bottom - graph.top);
    sketch.fill(fade(getColor("ZINC", 950), 0.7));
    sketch.rect(
      graph.left - 20,
      graph.top - 10,
      graph.right - graph.left + 34,
      graph.bottom - graph.top + 28,
      8
    );
    sketch.stroke(fade(getColor("WHITE"), 0.7));
    sketch.strokeWeight(1.5);
    sketch.line(graph.left, graph.bottom, graph.right, graph.bottom);
    sketch.line(graph.left, graph.bottom, graph.left, graph.top);
    const samples = Arr.makeBy(161, (index) => (index / 160) * t);
    for (const [curve, color] of [
      [
        (time: number) => recordedRate(frame, frame.background, time),
        PLOT_COLORS.slate,
      ],
      [(time: number) => recordedRate(frame, 0, time), PLOT_COLORS.teal],
    ] as const) {
      sketch.stroke(color);
      sketch.strokeWeight(2.5);
      for (const [a, b] of Arr.zip(samples, Arr.drop(samples, 1))) {
        sketch.line(x(a), y(curve(a)), x(b), y(curve(b)));
      }
    }
    dashed(
      sketch,
      { x: graph.left, y: y(frame.background) },
      { x: graph.right, y: y(frame.background) },
      {
        color: fade(PLOT_COLORS.amber, 0.85),
        dash: 5,
        weight: 1.5,
      }
    );
    Arr.forEach(
      Arr.makeBy(Math.floor(frame.time / frame.halfLife), (index) => index + 1),
      (count) => {
        const time = count * frame.halfLife;
        if (time <= t) {
          dashed(
            sketch,
            { x: x(time), y: graph.bottom },
            { x: x(time), y: y(recordedRate(frame, 0, time)) },
            {
              color: fade(PLOT_COLORS.teal, 0.6),
              dash: 3,
              weight: 1,
            }
          );
        }
      }
    );
    vignette(sketch, 0.3);
  };
}

interface HalfLifeCounterLabProps {
  /** The background count rate, in counts per minute. */
  background: number;
  description: NonNullable<ReactNode>;
  /** The first recorded count rate, background included, in counts per minute. */
  first: number;
  labels: {
    end: ReactNode;
    halfLife: ReactNode;
    start: ReactNode;
    viewLabel: string;
  };
  /** The later recorded count rate, background included, in counts per minute. */
  later: number;
  /** The time between the two readings, in hours. */
  time: number;
  title: NonNullable<ReactNode>;
}

/**
 * A Geiger-Muller counter in front of a radioactive sample records its rate
 * over time. The counter also records the background, which does not decay,
 * so the recorded curve levels off one background above zero. Subtract the
 * background and the sample's own rate halves once every half-life.
 */
export function HalfLifeCounterLab({
  background,
  description,
  first,
  labels,
  later,
  time,
  title,
}: HalfLifeCounterLabProps) {
  const quantity = useQuantity();
  const sample = halfLifeFromReadings({ first, later }, background, time);

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <VisualCardBody aria-label={labels.viewLabel} render={<section />}>
        <P5Sketch
          label={labels.viewLabel}
          program={counterProgram}
          state={{
            background,
            halfLife: sample.halfLife,
            start: sample.start,
            time,
          }}
        />
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.start}
            value={<InlineMath math={quantity(sample.start, "", 0)} />}
          />
          <VisualFactTabular
            label={labels.end}
            value={<InlineMath math={quantity(sample.end, "", 0)} />}
          />
          <VisualFactTabular
            label={labels.halfLife}
            value={
              <InlineMath math={quantity(sample.halfLife, "\\text{ h}", 1)} />
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
