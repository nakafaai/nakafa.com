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
import {
  BOBS,
  BobSchema,
  bobRadius,
  GRAVITY,
  pendulumPeriod,
  STRING_RANGE,
} from "@repo/design-system/components/contents/physics/measurement/pendulum/period";
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
import { MATERIAL } from "@repo/design-system/lib/material";
import { Array as Arr, Schema } from "effect";
import type p5 from "p5";
import { type ReactNode, useState } from "react";

/** The widest swing, in radians. */
const AMPLITUDE = 0.2;

/** How much larger than life the bobs are drawn, so the small ones stay visible. */
const BOB_ZOOM = 2.8;

/** What the sketch reads on every frame: the length of the three strings. */
const SwingFrame = Schema.Struct({ length: Schema.Number });

/** Each bob's surface: pale wood, polished brass, dull lead. */
function bobColors(bob: typeof BobSchema.Type) {
  if (bob === "wood") {
    return {
      dark: mix(MATERIAL.pine, getColor("BLACK"), 0.45),
      light: mix(MATERIAL.pine, getColor("WHITE"), 0.45),
    };
  }
  if (bob === "brass") {
    return {
      dark: mix(MATERIAL.brass, getColor("BLACK"), 0.5),
      light: mix(MATERIAL.brass, getColor("WHITE"), 0.65),
    };
  }
  return {
    dark: mix(MATERIAL.lead, getColor("BLACK"), 0.55),
    light: mix(MATERIAL.lead, getColor("WHITE"), 0.35),
  };
}

/** The lab wall, the bench and the lamp. */
function paintRoom(sketch: p5) {
  const { height, width } = sketch;
  gradientRect(sketch, { height, width, x: 0, y: 0 }, [
    [0, mix(getColor("NEUTRAL", 700), getColor("WHITE"), 0.1)],
    [0.9, getColor("NEUTRAL", 800)],
    [0.91, mix(getColor("STONE", 600), getColor("WHITE"), 0.15)],
    [1, mix(getColor("STONE", 600), getColor("BLACK"), 0.5)],
  ]);
  spotlight(sketch, { x: width * 0.5, y: height * 0.15 }, width * 0.65, {
    color: MATERIAL.lampLight,
    strength: 0.25,
  });
}

/**
 * Three pendulums of one length hanging from one bar, with a wooden, a brass
 * and a lead bob, swung to the moment `time`. They keep step, because no
 * power of mass can enter the period.
 */
function paintPendulums(sketch: p5, length: number, time: number) {
  const { height, width } = sketch;
  const bar = height * 0.08;
  const metre = (height * 0.74) / STRING_RANGE.max;
  withShadow(
    sketch,
    { blur: 16, color: fade(getColor("BLACK"), 0.55), drop: 7 },
    () => {
      gradientRect(
        sketch,
        {
          height: height * 0.025,
          width: width * 0.76,
          x: width * 0.12,
          y: bar - height * 0.0125,
        },
        steelStops(0.2)
      );
      gradientRect(
        sketch,
        {
          height: height * 0.85,
          width: width * 0.016,
          x: width * 0.1,
          y: bar - height * 0.02,
        },
        steelStops(0.3),
        true
      );
    }
  );
  const angle =
    AMPLITUDE *
    Math.cos((2 * Math.PI * time) / pendulumPeriod(length, BOBS.brass.mass));
  Arr.forEach(BobSchema.literals, (bob, index) => {
    const pivot = { x: width * (0.3 + index * 0.22), y: bar };
    const string = length * metre;
    const centre = {
      x: pivot.x + string * Math.sin(angle),
      y: pivot.y + string * Math.cos(angle),
    };
    sketch.noFill();
    sketch.stroke(fade(getColor("SLATE", 200), 0.12));
    sketch.strokeWeight(2);
    sketch.arc(
      pivot.x,
      pivot.y,
      string * 2,
      string * 2,
      Math.PI / 2 - AMPLITUDE,
      Math.PI / 2 + AMPLITUDE
    );
    sketch.stroke(fade(getColor("SLATE", 200), 0.9));
    sketch.strokeWeight(1.2);
    sketch.line(pivot.x, pivot.y, centre.x, centre.y);
    sketch.noStroke();
    const radius = bobRadius(bob) * metre * BOB_ZOOM;
    withShadow(
      sketch,
      { blur: 12, color: fade(getColor("BLACK"), 0.5), drop: 6 },
      () => {
        litBall(sketch, centre, radius, bobColors(bob));
      }
    );
  });
}

/** Draws one moment of the swing, in real time. */
function swingProgram(sketch: p5, read: () => typeof SwingFrame.Type) {
  let time = 0;
  sketch.setup = () => {
    sketch.createCanvas(1, 1);
    sketch.noStroke();
  };
  sketch.draw = () => {
    if (sketch.isLooping()) {
      time += Math.min(sketch.deltaTime / 1000, 0.1);
    }
    paintRoom(sketch);
    paintPendulums(sketch, read().length, time);
    vignette(sketch, 0.35);
  };
}

interface PendulumPeriodLabProps {
  description: ReactNode;
  labels: {
    check: ReactNode;
    gravity: ReactNode;
    length: string;
    masses: ReactNode;
    period: ReactNode;
    viewLabel: string;
  };
  /** The strings' length at first, in metres. */
  length?: number;
  title: ReactNode;
}

/**
 * Three pendulums of one length with a 50 g wooden bob, a 200 g brass bob
 * and a 500 g lead bob. They swing in step at every length, and a four times
 * longer string doubles their period: the period is 2π √(l/g), with mass to
 * the power zero, just as dimensional analysis predicts.
 */
export function PendulumPeriodLab({
  description,
  labels,
  length: initialLength = 0.8,
  title,
}: PendulumPeriodLabProps) {
  const [length, setLength] = useState(initialLength);
  const fixed = useFixed();
  const period = pendulumPeriod(length, BOBS.brass.mass);

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <VisualCardToolbar>
        <div className="flex w-full flex-col gap-3">
          <div className="flex items-center justify-between gap-4 text-sm">
            <span>{labels.length}</span>
            <span className="shrink-0 tabular-nums">
              <InlineMath math={`l=${fixed(length, "\\text{ m}", 2)}`} />
            </span>
          </div>
          <Slider
            aria-label={labels.length}
            max={STRING_RANGE.max}
            min={STRING_RANGE.min}
            onValueChange={setLength}
            step={0.05}
            value={length}
          />
        </div>
      </VisualCardToolbar>
      <VisualCardBody aria-label={labels.viewLabel} render={<section />}>
        <P5Sketch
          label={labels.viewLabel}
          program={swingProgram}
          state={{ length }}
        />
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.masses}
            value={
              <InlineMath
                math={`${fixed(BOBS.wood.mass * 1000, "\\text{ g}", 0)};\\ ${fixed(BOBS.brass.mass * 1000, "\\text{ g}", 0)};\\ ${fixed(BOBS.lead.mass * 1000, "\\text{ g}", 0)}`}
              />
            }
          />
          <VisualFactTabular
            label={labels.gravity}
            value={
              <InlineMath math={`g=${fixed(GRAVITY, "\\text{ m/s}^2", 2)}`} />
            }
          />
          <VisualFactTabular
            label={labels.period}
            value={
              <InlineMath
                math={`T=2\\pi\\sqrt{\\frac{l}{g}}=${fixed(period, "\\text{ s}", 2)}`}
              />
            }
          />
          <VisualFactTabular
            label={labels.check}
            value={
              <InlineMath math="[\mathrm{M}]^0[\mathrm{L}]^{\frac12}\left([\mathrm{L}][\mathrm{T}]^{-2}\right)^{-\frac12}=[\mathrm{T}]" />
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
