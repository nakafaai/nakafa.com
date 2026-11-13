import {
  advanceRun,
  shownTime,
} from "@repo/design-system/components/contents/physics/canvas/clock";
import {
  arrow,
  fade,
  gradientRect,
  litBall,
  mix,
  spotlight,
  vignette,
  withShadow,
} from "@repo/design-system/components/contents/physics/canvas/paint";
import { useFixed } from "@repo/design-system/components/contents/physics/measurement/digits";
import {
  GATE_RANGE,
  gateReading,
  TROLLEY_SPEED,
} from "@repo/design-system/components/contents/physics/measurement/gate/timing";
import { steelStops } from "@repo/design-system/components/contents/physics/measurement/scale";
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
import { Schema } from "effect";
import type p5 from "p5";
import { type ReactNode, useState } from "react";

/** How much track the scene shows, in metres. */
const TRACK_METRES = 1.7;

/** Where the first gate stands along the track, in metres. */
const FIRST_GATE = 0.25;

/** How far the trolley rolls past the second gate before the run ends, in metres. */
const RUN_OUT = 0.2;

/** The trolley's length, in metres. */
const TROLLEY_LENGTH = 0.16;

/** How long a finished run rests before the next, in seconds. */
const HOLD_SECONDS = 1.4;

/** What the sketch reads on every frame: how far apart the gates stand. */
const GateFrame = Schema.Struct({ distance: Schema.Number });

/** Positions of the track for one canvas size. */
function layout(sketch: p5) {
  const { height, width } = sketch;
  return { left: width * 0.04, metre: (width * 0.92) / TRACK_METRES, track: height * 0.62 };
}

/** The bench, the lamp and the aluminium track. */
function paintTrack(sketch: p5, place: ReturnType<typeof layout>) {
  const { height, width } = sketch;
  gradientRect(sketch, { height, width, x: 0, y: 0 }, [
    [0, mix(getColor("SLATE", 700), getColor("WHITE"), 0.1)],
    [0.66, getColor("SLATE", 800)],
    [0.67, mix(getColor("STONE", 600), getColor("WHITE"), 0.15)],
    [1, mix(getColor("STONE", 600), getColor("BLACK"), 0.55)],
  ]);
  spotlight(sketch, { x: width * 0.5, y: height * 0.35 }, width * 0.6, {
    color: mix(getColor("SLATE", 200), getColor("WHITE"), 0.6),
    strength: 0.24,
  });
  withShadow(sketch, { blur: 16, color: fade(getColor("BLACK"), 0.6), drop: 8 }, () => {
    gradientRect(sketch, { height: height * 0.045, width: TRACK_METRES * place.metre, x: place.left, y: place.track }, steelStops(0.1));
  });
}

/** Where a gate's beam crosses the track, above the track's top. */
function beamHeight(sketch: p5, place: ReturnType<typeof layout>) {
  return place.track - sketch.height * 0.22;
}

/**
 * The back arm of a light gate at `x`, seen from slightly above: a U frame
 * astride the track, whose beam runs from the back arm to the front one.
 */
function paintGateBack(sketch: p5, place: ReturnType<typeof layout>, x: number, cut: boolean) {
  const { height } = sketch;
  const arm = height * 0.028;
  const shift = height * 0.05;
  const top = place.track - height * 0.36;
  const beam = beamHeight(sketch, place);
  withShadow(sketch, { blur: 10, color: fade(getColor("BLACK"), 0.5), drop: 5 }, () => {
    sketch.fill(mix(getColor("ZINC", 900), getColor("SLATE", 600), 0.15));
    sketch.rect(x + shift - arm / 2, top - shift, arm, place.track - top - height * 0.02, 3);
    sketch.rect(x - arm / 2, top - shift, shift + arm, arm, 3);
  });
  sketch.stroke(fade(PLOT_COLORS.pink, cut ? 0.12 : 0.85));
  sketch.strokeWeight(cut ? 1 : 3);
  sketch.line(x + shift, beam - shift, x, beam);
  sketch.noStroke();
}

/** The front arm of a light gate at `x`, with its lamp lit while the beam is whole. */
function paintGateFront(sketch: p5, place: ReturnType<typeof layout>, x: number, cut: boolean) {
  const { height } = sketch;
  const arm = height * 0.03;
  const top = place.track - height * 0.41;
  withShadow(sketch, { blur: 12, color: fade(getColor("BLACK"), 0.55), drop: 6 }, () => {
    sketch.fill(mix(getColor("ZINC", 900), getColor("SLATE", 600), 0.35));
    sketch.rect(x - arm / 2, top, arm, place.track - top + height * 0.04, 3);
  });
  litBall(sketch, { x, y: beamHeight(sketch, place) }, arm * 0.32, {
    dark: cut ? getColor("ZINC", 900) : mix(PLOT_COLORS.pink, getColor("BLACK"), 0.3),
    light: cut ? getColor("SLATE", 600) : mix(PLOT_COLORS.pink, getColor("WHITE"), 0.6),
  });
}

/** The timer on the bench behind the track, its lamp lit while it counts, wired to both gates. */
function paintTimer(sketch: p5, place: ReturnType<typeof layout>, gates: readonly number[], running: boolean) {
  const { height, width } = sketch;
  const box = { x: width * 0.78, y: height * 0.08 };
  sketch.noFill();
  sketch.stroke(fade(getColor("ZINC", 950), 0.8));
  sketch.strokeWeight(2);
  for (const gate of gates) {
    sketch.bezier(box.x, box.y + height * 0.05, box.x - width * 0.1, box.y + height * 0.25, gate + width * 0.06, place.track - height * 0.55, gate + height * 0.05, place.track - height * 0.41);
  }
  sketch.noStroke();
  withShadow(sketch, { blur: 14, color: fade(getColor("BLACK"), 0.6), drop: 6 }, () => {
    gradientRect(sketch, { height: height * 0.11, width: width * 0.16, x: box.x, y: box.y }, [
      [0, getColor("SLATE", 600)],
      [1, getColor("ZINC", 900)],
    ]);
  });
  sketch.fill(getColor("ZINC", 950));
  sketch.rect(box.x + width * 0.015, box.y + height * 0.025, width * 0.09, height * 0.06, 3);
  litBall(sketch, { x: box.x + width * 0.135, y: box.y + height * 0.055 }, height * 0.016, {
    dark: running ? mix(PLOT_COLORS.teal, getColor("BLACK"), 0.2) : getColor("ZINC", 900),
    light: running ? mix(PLOT_COLORS.teal, getColor("WHITE"), 0.7) : getColor("SLATE", 600),
  });
}

/** The trolley with its card, its front at `front` metres along the track. */
function paintTrolley(sketch: p5, place: ReturnType<typeof layout>, front: number) {
  const { height } = sketch;
  const length = TROLLEY_LENGTH * place.metre;
  const right = place.left + front * place.metre;
  const wheel = height * 0.025;
  const body = height * 0.07;
  const bottom = place.track - wheel * 1.4;
  sketch.fill(fade(getColor("BLACK"), 0.35));
  sketch.ellipse(right - length / 2, place.track + 2, length * 1.05, wheel * 0.8);
  withShadow(sketch, { blur: 10, color: fade(getColor("BLACK"), 0.5), drop: 4 }, () => {
    gradientRect(sketch, { height: body, width: length, x: right - length, y: bottom - body }, [
      [0, mix(PLOT_COLORS.teal, getColor("WHITE"), 0.35)],
      [0.4, PLOT_COLORS.teal],
      [1, mix(PLOT_COLORS.teal, getColor("BLACK"), 0.45)],
    ]);
    sketch.fill(getColor("ZINC", 950));
    sketch.rect(right - length * 0.45, bottom - body - height * 0.15, length * 0.1, height * 0.15, 2);
  });
  for (const at of [0.2, 0.8]) {
    sketch.fill(getColor("ZINC", 900));
    sketch.circle(right - length + length * at, place.track - wheel, wheel * 2);
    sketch.fill(getColor("SLATE", 400));
    sketch.circle(right - length + length * at, place.track - wheel, wheel * 0.7);
  }
}

/**
 * Draws one moment of the run: the trolley rolls at a steady speed, the card
 * cuts the first beam and starts the timer, and the second beam stops it.
 */
function gateProgram(sketch: p5, read: () => typeof GateFrame.Type) {
  let time = 0;
  let shown = -1;
  sketch.setup = () => {
    sketch.createCanvas(1, 1);
    sketch.noStroke();
  };
  sketch.draw = () => {
    const { distance } = read();
    const duration = (FIRST_GATE + distance + RUN_OUT) / TROLLEY_SPEED;
    if (shown !== distance) {
      shown = distance;
      time = sketch.isLooping() ? 0 : duration;
    }
    if (sketch.isLooping()) {
      time = advanceRun(time, sketch.deltaTime / 1000, { duration, hold: HOLD_SECONDS, rate: 1 });
    }
    const now = shownTime(time, duration);
    const front = TROLLEY_LENGTH * 0.5 + TROLLEY_SPEED * now;
    const card = front - TROLLEY_LENGTH * 0.4;
    const place = layout(sketch);
    paintTrack(sketch, place);
    const first = place.left + FIRST_GATE * place.metre;
    const second = first + distance * place.metre;
    const running = card >= FIRST_GATE && card < FIRST_GATE + distance;
    const firstCut = Math.abs(card - FIRST_GATE) < TROLLEY_LENGTH * 0.1;
    const secondCut = Math.abs(card - FIRST_GATE - distance) < TROLLEY_LENGTH * 0.1;
    paintTimer(sketch, place, [first, second], running);
    paintGateBack(sketch, place, first, firstCut);
    paintGateBack(sketch, place, second, secondCut);
    paintTrolley(sketch, place, front);
    paintGateFront(sketch, place, first, firstCut);
    paintGateFront(sketch, place, second, secondCut);
    const span = place.track + sketch.height * 0.12;
    const ink = { color: PLOT_COLORS.fuchsia, head: 9, weight: 2.5 };
    arrow(sketch, { x: (first + second) / 2, y: span }, { x: first, y: span }, ink);
    arrow(sketch, { x: (first + second) / 2, y: span }, { x: second, y: span }, ink);
    vignette(sketch, 0.35);
  };
}

interface LightGateSpeedLabProps {
  description: ReactNode;
  /** How far apart the gates first stand, in metres. */
  distance?: number;
  labels: {
    distance: string;
    speed: ReactNode;
    time: ReactNode;
    viewLabel: string;
  };
  title: ReactNode;
}

/**
 * A trolley rolling through two light gates. The ruler gives the distance
 * between the gates and the timer the time between the beams, both base
 * quantities; their ratio is the derived quantity speed.
 */
export function LightGateSpeedLab({ description, distance: initialDistance = 0.6, labels, title }: LightGateSpeedLabProps) {
  const [distance, setDistance] = useState(initialDistance);
  const fixed = useFixed();
  const { speed, time } = gateReading(distance);

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <VisualCardToolbar>
        <div className="flex w-full flex-col gap-3">
          <div className="flex items-center justify-between gap-4 text-sm">
            <span>{labels.distance}</span>
            <span className="shrink-0 tabular-nums">
              <InlineMath math={`d=${fixed(distance, "\\text{ m}", 2)}`} />
            </span>
          </div>
          <Slider aria-label={labels.distance} max={GATE_RANGE.max} min={GATE_RANGE.min} onValueChange={setDistance} step={0.05} value={distance} />
        </div>
      </VisualCardToolbar>
      <VisualCardBody aria-label={labels.viewLabel} render={<section />}>
        <P5Sketch label={labels.viewLabel} program={gateProgram} state={{ distance }} />
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular label={labels.time} value={<InlineMath math={`t=${fixed(time, "\\text{ s}", 3)}`} />} />
          <VisualFactTabular
            label={labels.speed}
            value={<InlineMath math={`v=\\frac{d}{t}=\\frac{${fixed(distance, "\\text{ m}", 2)}}{${fixed(time, "\\text{ s}", 3)}}=${fixed(speed, "\\text{ m/s}", 2)}`} />}
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
