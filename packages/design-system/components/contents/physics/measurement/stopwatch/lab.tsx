import {
  advanceRun,
  shownTime,
} from "@repo/design-system/components/contents/physics/canvas/clock";
import {
  fade,
  gradientRect,
  litBall,
  mix,
  spotlight,
  vignette,
  withShadow,
} from "@repo/design-system/components/contents/physics/canvas/paint";
import { useFixed } from "@repo/design-system/components/contents/physics/measurement/digits";
import { steelStops } from "@repo/design-system/components/contents/physics/measurement/scale";
import {
  MAX_TRIALS,
  PERIOD,
  timingSpread,
  TRUE_TIME,
  trialTimes,
} from "@repo/design-system/components/contents/physics/measurement/stopwatch/trials";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { Slider } from "@repo/design-system/components/ui/slider";
import {
  VisualCard,
  VisualCardBody,
  VisualCardFacts,
  VisualCardFooter,
  VisualCardHeader,
  VisualCardToolbar,
} from "@repo/design-system/components/visual/card";
import { VisualFactTabular } from "@repo/design-system/components/visual/fact";
import { VisualCardSceneActions } from "@repo/design-system/components/visual/scene";
import { P5Sketch } from "@repo/design-system/components/visual/sketch";
import { getColor } from "@repo/design-system/lib/color";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Array as Arr, Option, Schema } from "effect";
import type p5 from "p5";
import { type ReactNode, useState } from "react";

/** How much faster than real time a trial plays. */
const PLAY_RATE = 3;

/** How long a finished trial rests before the next run, in wall seconds. */
const HOLD_SECONDS = 2;

/** The widest swing, in radians. */
const AMPLITUDE = 0.16;

/** The stretch of time the dot plot covers, in seconds. */
const PLOT_FROM = 17.7;
const PLOT_TO = 18.2;

/** What the sketch reads on every frame: how many trials are recorded. */
const TrialFrame = Schema.Struct({ count: Schema.Number });

/** The lab wall and the bench under the lamp. */
function paintRoom(sketch: p5) {
  const { height, width } = sketch;
  gradientRect(sketch, { height, width, x: 0, y: 0 }, [
    [0, mix(getColor("NEUTRAL", 700), getColor("WHITE"), 0.08)],
    [0.62, getColor("NEUTRAL", 800)],
    [0.63, mix(getColor("STONE", 600), getColor("BLACK"), 0.2)],
    [1, mix(getColor("STONE", 600), getColor("BLACK"), 0.65)],
  ]);
  spotlight(sketch, { x: width * 0.3, y: height * 0.2 }, width * 0.55, {
    color: mix(getColor("STONE", 600), getColor("WHITE"), 0.8),
    strength: 0.25,
  });
}

/** The retort stand and the brass bob, swung to the moment `time`. */
function paintPendulum(sketch: p5, time: number) {
  const { height, width } = sketch;
  const pivot = { x: width * 0.26, y: height * 0.07 };
  const length = height * 0.44;
  const angle = AMPLITUDE * Math.cos((2 * Math.PI * time) / PERIOD);
  const bob = { x: pivot.x + length * Math.sin(angle), y: pivot.y + length * Math.cos(angle) };
  withShadow(sketch, { blur: 14, color: fade(getColor("BLACK"), 0.55), drop: 6 }, () => {
    gradientRect(sketch, { height: height * 0.035, width: width * 0.3, x: width * 0.04, y: height * 0.6 }, steelStops(0.5));
    gradientRect(sketch, { height: height * 0.56, width: width * 0.014, x: width * 0.07, y: height * 0.05 }, steelStops(0.2), true);
    gradientRect(sketch, { height: height * 0.018, width: width * 0.2, x: width * 0.07, y: height * 0.06 }, steelStops(0.3));
  });
  sketch.stroke(fade(getColor("SLATE", 200), 0.9));
  sketch.strokeWeight(1.2);
  sketch.line(pivot.x, pivot.y, bob.x, bob.y);
  sketch.noStroke();
  sketch.fill(fade(getColor("BLACK"), 0.3));
  sketch.ellipse(bob.x, height * 0.615, height * 0.07, height * 0.012);
  withShadow(sketch, { blur: 12, color: fade(getColor("BLACK"), 0.5), drop: 5 }, () => {
    litBall(sketch, bob, height * 0.035, {
      dark: mix(PLOT_COLORS.amber, getColor("BLACK"), 0.5),
      light: mix(PLOT_COLORS.amber, getColor("WHITE"), 0.6),
    });
  });
}

/** An analog stopwatch with its hand at `time` seconds on a 60-second dial. */
function paintStopwatch(sketch: p5, time: number) {
  const { height, width } = sketch;
  const center = { x: width * 0.7, y: height * 0.34 };
  const radius = Math.min(width * 0.16, height * 0.21);
  withShadow(sketch, { blur: 22, color: fade(getColor("BLACK"), 0.6), drop: 9 }, () => {
    gradientRect(sketch, { height: radius * 0.22, width: radius * 0.26, x: center.x - radius * 0.13, y: center.y - radius * 1.28 }, steelStops(0.2), true);
    litBall(sketch, center, radius * 1.1, { dark: getColor("SLATE", 600), light: getColor("SLATE", 50) });
  });
  litBall(sketch, center, radius * 0.97, { dark: getColor("SLATE", 300), light: getColor("WHITE") });
  sketch.stroke(getColor("ZINC", 900));
  for (let tick = 0; tick < 60; tick += 1) {
    const angle = (tick / 60) * Math.PI * 2 - Math.PI / 2;
    const inner = radius * (tick % 5 === 0 ? 0.76 : 0.85);
    sketch.strokeWeight(tick % 5 === 0 ? 2.5 : 1);
    sketch.line(center.x + inner * Math.cos(angle), center.y + inner * Math.sin(angle), center.x + radius * 0.92 * Math.cos(angle), center.y + radius * 0.92 * Math.sin(angle));
  }
  const hand = ((time % 60) / 60) * Math.PI * 2 - Math.PI / 2;
  sketch.stroke(PLOT_COLORS.pink);
  sketch.strokeWeight(3);
  sketch.line(center.x - radius * 0.15 * Math.cos(hand), center.y - radius * 0.15 * Math.sin(hand), center.x + radius * 0.88 * Math.cos(hand), center.y + radius * 0.88 * Math.sin(hand));
  sketch.noStroke();
  sketch.fill(getColor("ZINC", 900));
  sketch.circle(center.x, center.y, radius * 0.1);
}

/**
 * The dot plot of the recorded trials: one dot per reading, stacked where
 * readings repeat, the mean in fuchsia, one standard deviation either side
 * in teal and the uncertainty of the mean in violet.
 */
function paintPlot(sketch: p5, times: readonly number[], latest: boolean) {
  const { height, width } = sketch;
  const left = width * 0.05;
  const plotWidth = width * 0.9;
  const top = height * 0.68;
  const base = height * 0.93;
  const toX = (time: number) => left + ((time - PLOT_FROM) / (PLOT_TO - PLOT_FROM)) * plotWidth;
  withShadow(sketch, { blur: 18, color: fade(getColor("BLACK"), 0.6), drop: 6 }, () => {
    sketch.fill(fade(getColor("ZINC", 950), 0.85));
    sketch.rect(left - width * 0.02, top - height * 0.03, plotWidth + width * 0.04, base - top + height * 0.06, 10);
  });
  const shown = latest ? times : Arr.take(times, times.length - 1);
  const { mean, spread, uncertainty } = timingSpread(times);
  if (times.length > 1) {
    sketch.fill(fade(PLOT_COLORS.teal, 0.3));
    sketch.rect(toX(mean - spread), top, toX(mean + spread) - toX(mean - spread), base - top);
    sketch.fill(fade(PLOT_COLORS.violet, 0.45));
    sketch.rect(toX(mean - uncertainty), top, toX(mean + uncertainty) - toX(mean - uncertainty), base - top);
    sketch.stroke(PLOT_COLORS.fuchsia);
    sketch.strokeWeight(3);
    sketch.line(toX(mean), top - height * 0.015, toX(mean), base);
  }
  sketch.stroke(getColor("SLATE", 400));
  sketch.strokeWeight(1.5);
  sketch.line(left, base, left + plotWidth, base);
  for (let tick = 0; tick <= 50; tick += 1) {
    const x = toX(PLOT_FROM + tick / 100);
    sketch.line(x, base, x, base + height * (tick % 10 === 0 ? 0.02 : tick % 5 === 0 ? 0.013 : 0.007));
  }
  sketch.noStroke();
  const dot = Math.min(plotWidth / 34, height * 0.05);
  Arr.forEach(shown, (time, index) => {
    const below = Arr.filter(Arr.take(shown, index), (other) => other === time).length;
    const isLatest = latest && index === times.length - 1;
    litBall(sketch, { x: toX(time), y: base - dot * (below + 0.6) }, dot * 0.45, {
      dark: isLatest ? mix(PLOT_COLORS.amber, getColor("BLACK"), 0.3) : mix(PLOT_COLORS.orange, getColor("BLACK"), 0.3),
      light: isLatest ? mix(PLOT_COLORS.amber, getColor("WHITE"), 0.6) : mix(PLOT_COLORS.orange, getColor("WHITE"), 0.5),
    });
  });
}

/**
 * Draws one moment of the latest trial: the pendulum swings ten times while
 * the stopwatch runs, and once the thumb stops it, the reading joins the plot.
 */
function trialProgram(sketch: p5, read: () => typeof TrialFrame.Type) {
  let time = 0;
  let shownCount = 0;
  sketch.setup = () => {
    sketch.createCanvas(1, 1);
    sketch.noStroke();
  };
  sketch.draw = () => {
    const { count } = read();
    const times = trialTimes(count);
    const duration = Option.getOrElse(Arr.last(times), () => TRUE_TIME);
    if (shownCount !== count) {
      shownCount = count;
      time = sketch.isLooping() ? 0 : duration;
    }
    if (sketch.isLooping()) {
      time = advanceRun(time, sketch.deltaTime / 1000, { duration, hold: HOLD_SECONDS, rate: PLAY_RATE });
    }
    const now = shownTime(time, duration);
    paintRoom(sketch);
    paintPendulum(sketch, now);
    paintStopwatch(sketch, now);
    paintPlot(sketch, times, now >= duration);
    vignette(sketch, 0.35);
  };
}

interface StopwatchSpreadLabProps {
  /** How many trials are recorded first. */
  count?: number;
  description: ReactNode;
  labels: {
    mean: ReactNode;
    spread: ReactNode;
    trials: string;
    uncertainty: ReactNode;
    viewLabel: string;
  };
  title: ReactNode;
}

/**
 * Ten swings of a pendulum timed by hand, trial after trial. Each reading
 * lands on a dot plot; the mean, the spread of single readings and the
 * uncertainty of the mean update as the trials pile up.
 */
export function StopwatchSpreadLab({ count: initialCount = 10, description, labels, title }: StopwatchSpreadLabProps) {
  const [count, setCount] = useState(initialCount);
  const fixed = useFixed();
  const { mean, spread, uncertainty } = timingSpread(trialTimes(count));

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <VisualCardToolbar>
        <div className="flex w-full flex-col gap-3">
          <div className="flex items-center justify-between gap-4 text-sm">
            <span>{labels.trials}</span>
            <span className="shrink-0 tabular-nums">
              <InlineMath math={`N=${count}`} />
            </span>
          </div>
          <Slider aria-label={labels.trials} max={MAX_TRIALS} min={2} onValueChange={setCount} step={1} value={count} />
        </div>
      </VisualCardToolbar>
      <VisualCardBody aria-label={labels.viewLabel} render={<section />}>
        <P5Sketch label={labels.viewLabel} program={trialProgram} state={{ count }} />
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular label={labels.mean} value={<InlineMath math={`\\bar t=${fixed(mean, "\\text{ s}", 3)}`} />} />
          <VisualFactTabular label={labels.spread} value={<InlineMath math={`s=${fixed(spread, "\\text{ s}", 3)}`} />} />
          <VisualFactTabular label={labels.uncertainty} value={<InlineMath math={`u(\\bar t)=${fixed(uncertainty, "\\text{ s}", 3)}`} />} />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
