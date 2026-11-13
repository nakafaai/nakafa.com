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
import { scientific } from "@repo/design-system/components/contents/physics/measurement/figures";
import { steelStops } from "@repo/design-system/components/contents/physics/measurement/scale";
import {
  BALL_DIAMETER,
  BALL_MASS,
  ballIn,
  UNIT_SYSTEMS,
  UnitSystemSchema,
} from "@repo/design-system/components/contents/physics/measurement/systems/ball";
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
import { Array as Arr, Schema } from "effect";
import type p5 from "p5";
import { type ReactNode, useState } from "react";

/** The dial's full scale, in kilograms: 20 pounds. */
const DIAL_FULL = 20 * UNIT_SYSTEMS.fps.mass;

/** How far the needle turns at full scale, in radians. */
const DIAL_SWEEP = (Math.PI * 5) / 3;

/** How tall the ruler stands, in metres. */
const RULER_HEIGHT = 0.3;

/** The units each system writes, as KaTeX. */
const UNIT_TEXT = {
  cgs: { length: "\\text{ cm}", mass: "\\text{ g}" },
  fps: { length: "\\text{ ft}", mass: "\\text{ lb}" },
  mks: { length: "\\text{ m}", mass: "\\text{ kg}" },
} as const;

/** The decimals each system's diameter is written with, keeping three significant figures. */
const LENGTH_DECIMALS = { cgs: 1, fps: 3, mks: 3 } as const;

/** What the sketch reads on every frame: the unit system the instruments are marked in. */
const SystemFrame = Schema.Struct({ system: UnitSystemSchema });

/** Positions of the scale, the ball and the ruler for one canvas size. */
function layout(sketch: p5) {
  const { height, width } = sketch;
  const platform = height * 0.66;
  const metre = (height * 0.42) / BALL_DIAMETER;
  return { centre: width * 0.42, metre, platform, ruler: width * 0.42 + (BALL_DIAMETER / 2) * metre + width * 0.03 };
}

/** The lab wall and the bench. */
function paintRoom(sketch: p5) {
  const { height, width } = sketch;
  gradientRect(sketch, { height, width, x: 0, y: 0 }, [
    [0, mix(getColor("SLATE", 600), getColor("WHITE"), 0.12)],
    [0.82, getColor("SLATE", 700)],
    [0.83, mix(getColor("STONE", 600), getColor("WHITE"), 0.15)],
    [1, mix(getColor("STONE", 600), getColor("BLACK"), 0.5)],
  ]);
  spotlight(sketch, { x: width * 0.4, y: height * 0.25 }, width * 0.6, {
    color: mix(getColor("SLATE", 200), getColor("WHITE"), 0.6),
    strength: 0.3,
  });
}

/**
 * The platform scale with its dial. The needle turns by the ball's mass,
 * which no unit changes; only the marks on the face follow the system.
 */
function paintScale(sketch: p5, place: ReturnType<typeof layout>, system: typeof UnitSystemSchema.Type) {
  const { height, width } = sketch;
  const left = place.centre - width * 0.2;
  withShadow(sketch, { blur: 20, color: fade(getColor("BLACK"), 0.6), drop: 9 }, () => {
    gradientRect(sketch, { height: height * 0.26, width: width * 0.4, x: left, y: place.platform + height * 0.025 }, [
      [0, mix(getColor("SLATE", 300), getColor("WHITE"), 0.3)],
      [1, getColor("SLATE", 600)],
    ]);
    gradientRect(sketch, { height: height * 0.025, width: width * 0.36, x: left + width * 0.02, y: place.platform }, steelStops(0.1));
  });
  const dial = { x: place.centre, y: place.platform + height * 0.15 };
  const radius = height * 0.1;
  litBall(sketch, dial, radius, { dark: getColor("SLATE", 300), light: getColor("WHITE") });
  const stepKilograms = system === "fps" ? UNIT_SYSTEMS.fps.mass : 0.5;
  sketch.stroke(getColor("ZINC", 900));
  Arr.forEach(Arr.range(0, Math.floor(DIAL_FULL / stepKilograms + 1e-9)), (mark) => {
    const angle = -Math.PI / 2 - DIAL_SWEEP / 2 + ((mark * stepKilograms) / DIAL_FULL) * DIAL_SWEEP;
    const major = mark % (system === "fps" ? 5 : 2) === 0;
    sketch.strokeWeight(major ? 2 : 1);
    const inner = radius * (major ? 0.68 : 0.78);
    sketch.line(dial.x + inner * Math.cos(angle), dial.y + inner * Math.sin(angle), dial.x + radius * 0.88 * Math.cos(angle), dial.y + radius * 0.88 * Math.sin(angle));
  });
  const needle = -Math.PI / 2 - DIAL_SWEEP / 2 + (BALL_MASS / DIAL_FULL) * DIAL_SWEEP;
  sketch.stroke(PLOT_COLORS.pink);
  sketch.strokeWeight(2.5);
  sketch.line(dial.x, dial.y, dial.x + radius * 0.85 * Math.cos(needle), dial.y + radius * 0.85 * Math.sin(needle));
  sketch.noStroke();
  sketch.fill(getColor("ZINC", 900));
  sketch.circle(dial.x, dial.y, radius * 0.12);
}

/** The bowling ball on the platform: a dark glossy sphere with its finger holes and a window's reflection. */
function paintBall(sketch: p5, place: ReturnType<typeof layout>) {
  const radius = (BALL_DIAMETER / 2) * place.metre;
  const center = { x: place.centre, y: place.platform - radius };
  withShadow(sketch, { blur: 26, color: fade(getColor("BLACK"), 0.7), drop: 10 }, () => {
    litBall(sketch, center, radius, {
      dark: mix(PLOT_COLORS.violet, getColor("BLACK"), 0.8),
      light: mix(PLOT_COLORS.violet, getColor("WHITE"), 0.15),
    });
  });
  sketch.fill(fade(getColor("ZINC", 950), 0.85));
  sketch.ellipse(center.x + radius * 0.12, center.y - radius * 0.35, radius * 0.16, radius * 0.2);
  sketch.ellipse(center.x + radius * 0.38, center.y - radius * 0.3, radius * 0.16, radius * 0.2);
  sketch.ellipse(center.x + radius * 0.3, center.y + radius * 0.05, radius * 0.2, radius * 0.24);
  sketch.fill(fade(getColor("WHITE"), 0.35));
  sketch.ellipse(center.x - radius * 0.38, center.y - radius * 0.42, radius * 0.3, radius * 0.16);
}

/**
 * The ruler standing on the platform, inches on its left edge and
 * centimetres on its right, with a set square resting on the ball's top.
 */
function paintRuler(sketch: p5, place: ReturnType<typeof layout>, system: typeof UnitSystemSchema.Type) {
  const { height, width } = sketch;
  const wide = width * 0.06;
  const tall = RULER_HEIGHT * place.metre;
  const top = place.platform - tall;
  withShadow(sketch, { blur: 14, color: fade(getColor("BLACK"), 0.55), drop: 6 }, () => {
    gradientRect(sketch, { height: tall, width: wide, x: place.ruler, y: top }, steelStops(0.05), true);
  });
  const inch = 0.0254 * place.metre;
  const imperial = system === "fps";
  paintTicksUp(sketch, place.ruler, place.platform, inch / 4, Math.floor(RULER_HEIGHT / 0.0254) * 4, wide, imperial ? 1 : 0.35, (index) => (index % 4 === 0 ? 0.45 : index % 2 === 0 ? 0.3 : 0.18));
  paintTicksUp(sketch, place.ruler + wide, place.platform, place.metre / 200, RULER_HEIGHT * 200, -wide, imperial ? 0.35 : 1, (index) => (index % 2 === 0 ? 0.45 : 0.25));
  const ballTop = place.platform - BALL_DIAMETER * place.metre;
  withShadow(sketch, { blur: 10, color: fade(getColor("BLACK"), 0.5), drop: 4 }, () => {
    sketch.fill(fade(mix(getColor("SLATE", 200), PLOT_COLORS.teal, 0.2), 0.75));
    sketch.triangle(place.centre - width * 0.02, ballTop, place.ruler + wide * 0.5, ballTop, place.ruler + wide * 0.5, ballTop - height * 0.12);
  });
  sketch.stroke(PLOT_COLORS.fuchsia);
  sketch.strokeWeight(3);
  sketch.line(place.centre, ballTop, place.ruler + wide, ballTop);
  sketch.noStroke();
}

/** Marks rising up a vertical edge at `x` from `base`, growing `toward` pixels across at full length. */
function paintTicksUp(sketch: p5, x: number, base: number, step: number, count: number, toward: number, strength: number, length: (index: number) => number) {
  sketch.push();
  sketch.stroke(fade(getColor("ZINC", 900), strength));
  sketch.strokeWeight(1);
  for (let index = 0; index <= count; index += 1) {
    const y = base - index * step;
    sketch.line(x, y, x + toward * length(index), y);
  }
  sketch.pop();
}

/** Draws the ball on the scale and the ruler beside it, marked in one system. */
function systemProgram(sketch: p5, read: () => typeof SystemFrame.Type) {
  sketch.setup = () => {
    sketch.createCanvas(1, 1);
    sketch.noStroke();
  };
  sketch.draw = () => {
    const { system } = read();
    const place = layout(sketch);
    paintRoom(sketch);
    paintScale(sketch, place, system);
    paintBall(sketch, place);
    paintRuler(sketch, place, system);
    vignette(sketch, 0.35);
  };
}

interface UnitSystemsLabProps {
  description: ReactNode;
  labels: {
    chooseSystem: string;
    diameter: ReactNode;
    mass: ReactNode;
    systems: Record<typeof UnitSystemSchema.Type, ReactNode>;
    time: ReactNode;
    viewLabel: string;
  };
  title: ReactNode;
}

/**
 * A 16 lb bowling ball weighed on a dial scale and measured against a ruler
 * with inches on one edge and centimetres on the other. Switch between FPS,
 * CGS and MKS: the needle and the ball stay put, and only the numbers change.
 */
export function UnitSystemsLab({ description, labels, title }: UnitSystemsLabProps) {
  const [system, setSystem] = useState<typeof UnitSystemSchema.Type>("mks");
  const fixed = useFixed();
  const { diameter, mass } = ballIn(system);
  const grams = scientific(mass, 3);
  const isSystem = Schema.is(UnitSystemSchema);

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <VisualCardToolbar>
        <ToggleGroup
          aria-label={labels.chooseSystem}
          gridColumns="3"
          onValueChange={(value) => {
            if (isSystem(value)) {
              setSystem(value);
            }
          }}
          type="single"
          value={system}
          variant="outline"
        >
          {Arr.map(UnitSystemSchema.literals, (option) => (
            <ToggleGroupItem key={option} value={option}>
              {labels.systems[option]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </VisualCardToolbar>
      <VisualCardBody aria-label={labels.viewLabel} render={<section />}>
        <P5Sketch label={labels.viewLabel} program={systemProgram} state={{ system }} />
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular label={labels.diameter} value={<InlineMath math={fixed(diameter, UNIT_TEXT[system].length, LENGTH_DECIMALS[system])} />} />
          <VisualFactTabular
            label={labels.mass}
            value={
              <InlineMath
                math={system === "cgs" ? `${fixed(grams.coefficient, "", 2)}\\times10^{${grams.exponent}}${UNIT_TEXT.cgs.mass}` : fixed(mass, UNIT_TEXT[system].mass, system === "fps" ? 1 : 2)}
              />
            }
          />
          <VisualFactTabular label={labels.time} value={<InlineMath math="\text{s}" />} />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
