import {
  advanceRun,
  shownTime,
} from "@repo/design-system/components/contents/physics/canvas/clock";
import {
  createBackdrop,
  fade,
  gradientRect,
  mix,
  spotlight,
  vignette,
  withShadow,
} from "@repo/design-system/components/contents/physics/canvas/paint";
import {
  GAPS_PER_STRIP,
  STRIP_SECONDS,
  stripAcceleration,
  TAPE_MOTIONS,
  type TapeMotion,
  TapeMotionSchema,
  TICKS_PER_SECOND,
  tapePosition,
  tapeStrips,
  tapeTicks,
} from "@repo/design-system/components/contents/physics/kinematics/ticker/tape";
import { useQuantity } from "@repo/design-system/components/contents/simulation/quantity";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@repo/design-system/components/ui/toggle-group";
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

/** How much slower than real time the run plays: 0.8 s of motion over 3.2 s. */
const PLAY_RATE = 0.25;

/** How long the finished tape rests before the run starts again, in wall seconds. */
const HOLD_SECONDS = 1.6;

/** How much bench the scene shows past the timer, in metres. */
const BENCH_METRES = 0.62;

/** What the sketch reads on every frame: the motion the trolley makes. */
const TickerFrameSchema = Schema.Struct({
  motion: TapeMotionSchema,
});
type TickerFrame = typeof TickerFrameSchema.Type;

/** Positions of the bench scene and the strip chart for one canvas size. */
function layout(sketch: p5) {
  const { height, width } = sketch;
  const benchTop = height * 0.46;
  const timerX = width * 0.16;
  return {
    benchTop,
    chartBase: height * 0.94,
    chartHeight: height * 0.28,
    chartLeft: width * 0.1,
    chartWidth: width * 0.8,
    metre: (width * 0.8) / BENCH_METRES,
    timerX,
  };
}

/** How far a millimetre-scale tick reaches up the bench edge: long every 10 cm, middle every 5 cm. */
function tickLength(board: number, long: boolean, middle: boolean) {
  if (long) {
    return board * 0.7;
  }
  return middle ? board * 0.45 : board * 0.25;
}

/** The wall, the bench and its millimetre scale, which never move. */
function paintBench(sketch: p5, place: ReturnType<typeof layout>) {
  const { height, width } = sketch;
  gradientRect(sketch, { height, width, x: 0, y: 0 }, [
    [0, getColor("NEUTRAL", 700)],
    [0.55, getColor("NEUTRAL", 800)],
    [1, mix(getColor("NEUTRAL", 800), getColor("BLACK"), 0.35)],
  ]);
  spotlight(
    sketch,
    { x: width * 0.45, y: place.benchTop * 0.55 },
    width * 0.55,
    {
      color: mix(getColor("STONE", 600), getColor("WHITE"), 0.7),
      strength: 0.22,
    }
  );
  const board = height * 0.05;
  withShadow(
    sketch,
    { blur: 18, color: fade(getColor("BLACK"), 0.6), drop: 8 },
    () => {
      gradientRect(
        sketch,
        {
          height: board,
          width: width * 0.94,
          x: width * 0.03,
          y: place.benchTop,
        },
        [
          [0, mix(getColor("STONE", 600), getColor("WHITE"), 0.55)],
          [0.25, mix(getColor("STONE", 600), getColor("WHITE"), 0.35)],
          [1, getColor("STONE", 600)],
        ]
      );
    }
  );
  sketch.stroke(fade(mix(getColor("STONE", 600), getColor("BLACK"), 0.4), 0.7));
  for (let centimetre = 0; centimetre <= BENCH_METRES * 100; centimetre += 1) {
    const x = place.timerX + (centimetre / 100) * place.metre;
    const long = centimetre % 10 === 0;
    const middle = centimetre % 5 === 0;
    sketch.strokeWeight(long ? 1.4 : 0.8);
    sketch.line(
      x,
      place.benchTop + board,
      x,
      place.benchTop + board - tickLength(board, long, middle)
    );
  }
  sketch.noStroke();
}

/** The timer clamped at the bench's left end, its striker shaking as it prints. */
function paintTimer(
  sketch: p5,
  place: ReturnType<typeof layout>,
  time: number,
  running: boolean
) {
  const size = sketch.height * 0.11;
  const left = place.timerX - size * 1.05;
  const top = place.benchTop - size * 0.9;
  withShadow(
    sketch,
    { blur: 14, color: fade(getColor("BLACK"), 0.55), drop: 6 },
    () => {
      gradientRect(
        sketch,
        { height: size * 0.9, width: size, x: left, y: top },
        [
          [0, getColor("SLATE", 400)],
          [1, getColor("SLATE", 700)],
        ]
      );
    }
  );
  sketch.fill(getColor("ZINC", 900));
  sketch.circle(left + size * 0.5, top + size * 0.32, size * 0.34);
  const shake = running
    ? Math.sin(time * TICKS_PER_SECOND * Math.PI * 2) * size * 0.04
    : 0;
  sketch.stroke(getColor("SLATE", 200));
  sketch.strokeWeight(2);
  sketch.line(
    left + size * 0.5,
    top + size * 0.32,
    place.timerX - size * 0.05,
    place.benchTop - size * 0.12 + shake
  );
  sketch.noStroke();
}

/** The paper tape from the timer to the trolley, with every dot printed so far. */
function paintTape(
  sketch: p5,
  place: ReturnType<typeof layout>,
  motion: TapeMotion,
  time: number
) {
  const travelled = tapePosition(motion, time) * place.metre;
  const thick = sketch.height * 0.028;
  const top = place.benchTop - thick;
  sketch.fill(mix(getColor("STONE", 600), getColor("WHITE"), 0.9));
  sketch.rect(
    place.timerX - sketch.height * 0.03,
    top,
    travelled + sketch.height * 0.03,
    thick
  );
  sketch.fill(mix(getColor("NEUTRAL", 800), getColor("BLACK"), 0.35));
  for (const tick of tapeTicks(motion)) {
    if (tick <= time + 1e-9) {
      const x =
        place.timerX + travelled - tapePosition(motion, tick) * place.metre;
      sketch.circle(x, top + thick / 2, Math.max(2.4, thick * 0.32));
    }
  }
  return place.timerX + travelled;
}

/** The trolley, lit from above, standing on its shadow at the tape's end. */
function paintTrolley(
  sketch: p5,
  place: ReturnType<typeof layout>,
  rear: number
) {
  const length = sketch.height * 0.26;
  const tall = sketch.height * 0.09;
  const wheel = sketch.height * 0.034;
  const bottom = place.benchTop - wheel * 1.4;
  sketch.fill(fade(getColor("BLACK"), 0.35));
  sketch.ellipse(
    rear + length / 2,
    place.benchTop - 1,
    length * 1.05,
    wheel * 0.9
  );
  withShadow(
    sketch,
    { blur: 10, color: fade(getColor("BLACK"), 0.5), drop: 4 },
    () => {
      gradientRect(
        sketch,
        { height: tall, width: length, x: rear, y: bottom - tall },
        [
          [0, fade(PLOT_COLORS.orange, 0.75)],
          [0.35, PLOT_COLORS.orange],
          [1, mix(getColor("STONE", 600), getColor("BLACK"), 0.4)],
        ]
      );
    }
  );
  for (const at of [0.2, 0.8]) {
    sketch.fill(getColor("ZINC", 900));
    sketch.circle(rear + length * at, place.benchTop - wheel, wheel * 2);
    sketch.fill(getColor("SLATE", 400));
    sketch.circle(rear + length * at, place.benchTop - wheel, wheel * 0.7);
  }
}

/** The tape cut into tenth-second strips and stood side by side: a velocity-time chart. */
function paintChart(
  sketch: p5,
  place: ReturnType<typeof layout>,
  motion: TapeMotion,
  time: number
) {
  const strips = tapeStrips(motion);
  const tallest = Math.max(...strips);
  const slot = place.chartWidth / strips.length;
  const width = slot * 0.72;
  sketch.stroke(getColor("NEUTRAL", 300));
  sketch.strokeWeight(1.5);
  sketch.line(
    place.chartLeft,
    place.chartBase,
    place.chartLeft + place.chartWidth,
    place.chartBase
  );
  sketch.line(
    place.chartLeft,
    place.chartBase,
    place.chartLeft,
    place.chartBase - place.chartHeight * 1.08
  );
  sketch.noStroke();
  Arr.forEach(strips, (strip, index) => {
    if (time + 1e-9 < (index + 1) * STRIP_SECONDS) {
      return;
    }
    const height = (strip / tallest) * place.chartHeight;
    const left = place.chartLeft + slot * index + (slot - width) / 2;
    withShadow(
      sketch,
      { blur: 8, color: fade(getColor("BLACK"), 0.45), drop: 3 },
      () => {
        sketch.fill(mix(getColor("STONE", 600), getColor("WHITE"), 0.9));
        sketch.rect(left, place.chartBase - height, width, height);
      }
    );
    sketch.fill(index % 2 === 0 ? PLOT_COLORS.teal : PLOT_COLORS.violet);
    sketch.rect(
      left,
      place.chartBase - height,
      width,
      Math.max(3, height * 0.04)
    );
    sketch.fill(mix(getColor("NEUTRAL", 800), getColor("BLACK"), 0.35));
    const start = tapePosition(motion, index * STRIP_SECONDS);
    for (let gap = 0; gap < GAPS_PER_STRIP; gap += 1) {
      const moved =
        tapePosition(
          motion,
          (index * GAPS_PER_STRIP + gap) / TICKS_PER_SECOND
        ) - start;
      sketch.circle(
        left + width / 2,
        place.chartBase - (moved / tallest) * place.chartHeight - 3,
        3.2
      );
    }
  });
}

/**
 * Draws one moment of the run: the trolley pulls the tape through the
 * timer, which prints a dot every fiftieth of a second, and each finished
 * tenth of a second of tape joins the strip chart below.
 */
function tickerProgram(sketch: p5, read: () => TickerFrame) {
  let time = 0;
  let shown: TapeMotion | undefined;
  const backdrop = createBackdrop();
  sketch.setup = () => {
    sketch.createCanvas(1, 1);
    sketch.noStroke();
  };
  sketch.draw = () => {
    const { motion } = read();
    const { duration } = TAPE_MOTIONS[motion];
    if (shown !== motion) {
      shown = motion;
      time = sketch.isLooping() ? 0 : duration;
    }
    if (sketch.isLooping()) {
      time = advanceRun(time, sketch.deltaTime / 1000, {
        duration,
        hold: HOLD_SECONDS,
        rate: PLAY_RATE,
      });
    }
    const now = shownTime(time, duration);
    const place = layout(sketch);
    backdrop(sketch, "bench", (layer) => paintBench(layer, place));
    paintTimer(sketch, place, now, sketch.isLooping() && now < duration);
    const rear = paintTape(sketch, place, motion, now);
    paintTrolley(sketch, place, rear);
    paintChart(sketch, place, motion, now);
    vignette(sketch, 0.35);
  };
}

interface TickerTapeMotionLabProps {
  description: ReactNode;
  labels: {
    acceleration: ReactNode;
    chooseMotion: string;
    firstStrip: ReactNode;
    interval: ReactNode;
    lastStrip: ReactNode;
    motions: Record<TapeMotion, ReactNode>;
    viewLabel: string;
  };
  /** The motion the trolley makes first. */
  motion?: TapeMotion;
  title: ReactNode;
}

/**
 * A ticker timer on a lab bench: a trolley pulls paper tape through a timer
 * that prints a dot every 0.02 s, and the tape is cut into 0.1 s strips that
 * stand side by side as a velocity-time chart. Equal strips mean constant
 * velocity; strips that grow or shrink by the same step mean constant
 * acceleration.
 */
export function TickerTapeMotionLab({
  description,
  labels,
  motion: initialMotion = "speeding",
  title,
}: TickerTapeMotionLabProps) {
  const [motion, setMotion] = useState<TapeMotion>(initialMotion);
  const measure = useQuantity();
  const strips = tapeStrips(motion);
  const isMotion = Schema.is(TapeMotionSchema);

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <VisualCardToolbar>
        <ToggleGroup
          aria-label={labels.chooseMotion}
          gridColumns="3"
          onValueChange={(value) => {
            if (isMotion(value)) {
              setMotion(value);
            }
          }}
          type="single"
          value={motion}
          variant="outline"
        >
          {Arr.map(TapeMotionSchema.literals, (option) => (
            <ToggleGroupItem key={option} value={option}>
              {labels.motions[option]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </VisualCardToolbar>
      <VisualCardBody aria-label={labels.viewLabel} render={<section />}>
        <P5Sketch
          label={labels.viewLabel}
          program={tickerProgram}
          state={{ motion }}
        />
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.interval}
            value={
              <InlineMath
                math={measure(1 / TICKS_PER_SECOND, "\\text{ s}", 2)}
              />
            }
          />
          <VisualFactTabular
            label={labels.firstStrip}
            value={
              <InlineMath
                math={measure(
                  Option.getOrElse(Arr.head(strips), () => 0) * 100,
                  "\\text{ cm}",
                  1
                )}
              />
            }
          />
          <VisualFactTabular
            label={labels.lastStrip}
            value={
              <InlineMath
                math={measure(
                  Option.getOrElse(Arr.last(strips), () => 0) * 100,
                  "\\text{ cm}",
                  1
                )}
              />
            }
          />
          <VisualFactTabular
            label={labels.acceleration}
            value={
              <InlineMath
                math={measure(stripAcceleration(strips), "\\text{ m/s}^2", 1)}
              />
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
