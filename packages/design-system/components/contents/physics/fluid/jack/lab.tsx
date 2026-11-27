import {
  arrow,
  fade,
  gradientRect,
  mix,
  vignette,
} from "@repo/design-system/components/contents/physics/canvas/paint";
import { LabSlider } from "@repo/design-system/components/contents/physics/canvas/slider";
import { hydraulicJack } from "@repo/design-system/components/contents/physics/fluid/pressure";
import { paintBench } from "@repo/design-system/components/contents/physics/heat/glass";
import { useQuantity } from "@repo/design-system/components/contents/simulation/quantity";
import { InlineMath } from "@repo/design-system/components/markdown/math";
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
import { BENCH_COLORS } from "@repo/design-system/lib/material/bench";
import { CAR_COLORS } from "@repo/design-system/lib/material/car";
import { ENERGY_COLORS } from "@repo/design-system/lib/material/energy";
import { INSTRUMENT_COLORS } from "@repo/design-system/lib/material/instrument";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Schema } from "effect";
import type p5 from "p5";
import type { ReactNode } from "react";
import { useState } from "react";

/** Wall seconds one stroke of the small piston takes, then the same back. */
const STROKE_SECONDS = 2.4;

/** What the sketch reads on every frame. */
const JackFrameSchema = Schema.Struct({
  force: Schema.Finite,
  large: Schema.Finite,
  small: Schema.Finite,
  stroke: Schema.Finite,
});
type JackFrame = typeof JackFrameSchema.Type;

/**
 * Draws one moment of the jack in section: the oil in both cylinders and the
 * pipe joining them, each cylinder as wide as its piston's diameter, the
 * small piston pushed down through its stroke, and the large piston carrying
 * a crate up by the same volume spread over its larger area.
 */
function jackProgram(sketch: p5, read: () => JackFrame) {
  let clock = 0;
  sketch.setup = () => {
    sketch.createCanvas(1, 1);
  };
  sketch.draw = () => {
    const frame = read();
    if (sketch.isLooping()) {
      clock =
        (clock + Math.min(sketch.deltaTime / 1000, 0.1) / STROKE_SECONDS) % 2;
    }
    const push = clock < 1 ? clock : 2 - clock;
    const { height, width } = sketch;
    const top = height * 0.88;
    paintBench(sketch, top);
    const largeWidth = width * 0.42;
    const smallWidth = largeWidth * Math.sqrt(frame.small / frame.large);
    const smallX = width * 0.12;
    const largeX = width * 0.46;
    const base = top - height * 0.08;
    const pipe = height * 0.06;
    const centimetre = (height * 0.32) / Math.max(frame.stroke, 1);
    const smallTop = base - height * 0.5 + push * frame.stroke * centimetre;
    const rise = push * frame.stroke * (frame.small / frame.large) * centimetre;
    const largeTop = base - height * 0.3 - rise;
    const oil = ENERGY_COLORS.dieselFuel;
    gradientRect(
      sketch,
      {
        height: pipe,
        width: largeX + largeWidth - smallX,
        x: smallX,
        y: base - pipe,
      },
      [
        [0, oil],
        [1, mix(oil, getColor("BLACK"), 0.3)],
      ]
    );
    gradientRect(
      sketch,
      { height: base - smallTop, width: smallWidth, x: smallX, y: smallTop },
      [
        [0, oil],
        [1, mix(oil, getColor("BLACK"), 0.3)],
      ],
      true
    );
    gradientRect(
      sketch,
      { height: base - largeTop, width: largeWidth, x: largeX, y: largeTop },
      [
        [0, oil],
        [1, mix(oil, getColor("BLACK"), 0.3)],
      ],
      true
    );
    sketch.noFill();
    sketch.stroke(fade(BENCH_COLORS.glass, 0.7));
    sketch.strokeWeight(3);
    sketch.rect(
      smallX - 3,
      base - height * 0.62,
      smallWidth + 6,
      height * 0.62
    );
    sketch.rect(largeX - 3, base - height * 0.5, largeWidth + 6, height * 0.5);
    sketch.noStroke();
    sketch.fill(INSTRUMENT_COLORS.aluminium);
    sketch.rect(smallX, smallTop - 10, smallWidth, 10);
    sketch.rect(largeX, largeTop - 12, largeWidth, 12);
    sketch.fill(CAR_COLORS.castIron);
    sketch.rect(
      smallX + smallWidth / 2 - 3,
      smallTop - height * 0.12,
      6,
      height * 0.12
    );
    sketch.fill(ENERGY_COLORS.crateWood);
    sketch.rect(
      largeX + largeWidth * 0.15,
      largeTop - 12 - height * 0.16,
      largeWidth * 0.7,
      height * 0.16,
      3
    );
    sketch.stroke(
      fade(mix(ENERGY_COLORS.crateWood, getColor("BLACK"), 0.4), 0.8)
    );
    sketch.strokeWeight(2);
    sketch.line(
      largeX + largeWidth * 0.15,
      largeTop - 12 - height * 0.08,
      largeX + largeWidth * 0.85,
      largeTop - 12 - height * 0.08
    );
    const handle = { x: smallX + smallWidth / 2, y: smallTop - height * 0.12 };
    arrow(sketch, { x: handle.x, y: handle.y - height * 0.1 }, handle, {
      color: PLOT_COLORS.pink,
      head: 11,
      weight: 3.5,
    });
    const crate = {
      x: largeX + largeWidth / 2,
      y: largeTop - 12 - height * 0.16,
    };
    arrow(
      sketch,
      crate,
      { x: crate.x, y: crate.y - height * 0.1 },
      { color: PLOT_COLORS.teal, head: 11, weight: 3.5 }
    );
    vignette(sketch, 0.3);
  };
}

interface HydraulicJackLabProps {
  description: NonNullable<ReactNode>;
  /** The force pushing down on the small piston, in newtons. */
  force: number;
  labels: {
    force: ReactNode;
    forceName: string;
    lifted: ReactNode;
    mass: ReactNode;
    pressure: ReactNode;
    rise: ReactNode;
    viewLabel: string;
  };
  /** The cross-sectional area of the large piston, in m². */
  largeArea: number;
  /** The cross-sectional area of the small piston, in m². */
  smallArea: number;
  /** How far the small piston is pushed down, in centimetres. */
  stroke: number;
  title: NonNullable<ReactNode>;
}

/**
 * A hydraulic jack in section, each cylinder drawn as wide as its piston.
 * Push the small piston down: the pressure it makes spreads unchanged through
 * the oil, so the large piston feels it over its whole area and lifts a far
 * heavier load, while the oil it moves spreads over that area and lifts the
 * load only a little way.
 */
export function HydraulicJackLab({
  description,
  force: start,
  labels,
  largeArea,
  smallArea,
  stroke,
  title,
}: HydraulicJackLabProps) {
  const quantity = useQuantity();
  const [force, setForce] = useState(start);
  const jack = hydraulicJack({
    force,
    large: largeArea,
    small: smallArea,
    stroke,
  });

  return (
    <VisualCard
      onReset={() => {
        setForce(start);
      }}
    >
      <VisualCardHeader description={description} title={title} />
      <VisualCardToolbar>
        <LabSlider
          label={<span>{labels.force}</span>}
          max={Math.max(300, start * 2)}
          min={10}
          name={labels.forceName}
          onValueChange={setForce}
          readout={<InlineMath math={quantity(force, "\\text{ N}", 0)} />}
          step={10}
          value={force}
        />
      </VisualCardToolbar>
      <VisualCardBody aria-label={labels.viewLabel} render={<section />}>
        <P5Sketch
          label={labels.viewLabel}
          program={jackProgram}
          state={{ force, large: largeArea, small: smallArea, stroke }}
        />
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.pressure}
            value={
              <InlineMath math={quantity(jack.pressure, "\\text{ Pa}", 0)} />
            }
          />
          <VisualFactTabular
            label={labels.lifted}
            value={<InlineMath math={quantity(jack.lifted, "\\text{ N}", 0)} />}
          />
          <VisualFactTabular
            label={labels.mass}
            value={<InlineMath math={quantity(jack.mass, "\\text{ kg}", 0)} />}
          />
          <VisualFactTabular
            label={labels.rise}
            value={<InlineMath math={quantity(jack.rise, "\\text{ cm}", 2)} />}
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
