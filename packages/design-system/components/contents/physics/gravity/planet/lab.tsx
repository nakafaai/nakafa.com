import { caption } from "@repo/design-system/components/contents/physics/canvas/caption";
import {
  fade,
  gradientRect,
  litBall,
  mix,
  vignette,
} from "@repo/design-system/components/contents/physics/canvas/paint";
import { planetRatios } from "@repo/design-system/components/contents/physics/gravity/kepler";
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
import { ENERGY_COLORS } from "@repo/design-system/lib/material/energy";
import { TOWN_COLORS } from "@repo/design-system/lib/material/town";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Schema } from "effect";
import type p5 from "p5";
import type { ReactNode } from "react";

/** Wall seconds a satellite skimming the Earth takes for one lap. */
const LAP_SECONDS = 4;

/** What the sketch reads on every frame. */
const PlanetFrameSchema = Schema.Struct({
  earthName: Schema.String,
  period: Schema.Finite,
  planetName: Schema.String,
  radius: Schema.Finite,
});
type PlanetFrame = typeof PlanetFrameSchema.Type;

/**
 * Draws the Earth and the planet side by side at the same scale, each with a
 * satellite skimming its surface and lapping at the pace its period sets
 * relative to the Earth's.
 */
function planetProgram(sketch: p5, read: () => PlanetFrame) {
  let clock = 0;
  sketch.setup = () => {
    sketch.createCanvas(1, 1);
  };
  sketch.draw = () => {
    const frame = read();
    if (sketch.isLooping()) {
      clock += Math.min(sketch.deltaTime / 1000, 0.1);
    }
    const { height, width } = sketch;
    gradientRect(sketch, { height, width, x: 0, y: 0 }, [
      [0, ENERGY_COLORS.nightSky],
      [1, getColor("ZINC", 950)],
    ]);
    const unit = Math.min(width / (2 * (1 + frame.radius) * 1.6), height * 0.3);
    const bodies = [
      {
        color: TOWN_COLORS.water,
        name: frame.earthName,
        period: 1,
        radius: 1,
        x: width * 0.06 + unit * 1.3,
      },
      {
        color: ENERGY_COLORS.rock,
        name: frame.planetName,
        period: frame.period,
        radius: frame.radius,
        x: width * 0.94 - unit * frame.radius * 1.3,
      },
    ];
    for (const body of bodies) {
      const at = { x: body.x, y: height * 0.48 };
      const size = body.radius * unit;
      litBall(sketch, at, size, {
        dark: mix(body.color, getColor("BLACK"), 0.6),
        light: mix(body.color, getColor("WHITE"), 0.35),
      });
      sketch.noFill();
      sketch.stroke(fade(PLOT_COLORS.teal, 0.5));
      sketch.strokeWeight(1.5);
      sketch.circle(at.x, at.y, size * 2.2);
      const angle = (clock / (LAP_SECONDS * body.period)) * Math.PI * 2;
      sketch.noStroke();
      sketch.fill(PLOT_COLORS.teal);
      sketch.rect(
        at.x + Math.cos(angle) * size * 1.1 - 4,
        at.y - Math.sin(angle) * size * 1.1 - 4,
        8,
        8,
        2
      );
      caption(
        sketch,
        body.name,
        { x: at.x, y: at.y + size * 1.25 + 8 },
        {
          align: "center",
          baseline: "top",
          color: getColor("WHITE"),
          size: 14,
        }
      );
    }
    vignette(sketch, 0.35);
  };
}

/** A ratio to the Earth's value, written as so many times. */
function Times({ value }: { readonly value: number }) {
  const quantity = useQuantity();
  return <InlineMath math={quantity(value, "\\times", 2)} />;
}

interface PlanetCompareLabProps {
  description: NonNullable<ReactNode>;
  labels: {
    earthName: string;
    escape: ReactNode;
    gravity: ReactNode;
    orbit: ReactNode;
    period: ReactNode;
    planetName: string;
    viewLabel: string;
  };
  /** The planet's mass, in Earth masses. */
  mass: number;
  /** The planet's radius, in Earth radii. */
  radius: number;
  title: NonNullable<ReactNode>;
}

/**
 * The Earth and another planet side by side at the same scale, each with a
 * satellite skimming its surface. Surface gravity follows M/R², the escape
 * and orbital speeds follow √(M/R), and the period follows √(R³/M), so the
 * same planet can halve one quantity, keep another and double a third.
 */
export function PlanetCompareLab({
  description,
  labels,
  mass,
  radius,
  title,
}: PlanetCompareLabProps) {
  const ratios = planetRatios(mass, radius);

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <VisualCardBody aria-label={labels.viewLabel} render={<section />}>
        <P5Sketch
          label={labels.viewLabel}
          program={planetProgram}
          state={{
            earthName: labels.earthName,
            period: ratios.period,
            planetName: labels.planetName,
            radius,
          }}
        />
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.gravity}
            value={<Times value={ratios.gravity} />}
          />
          <VisualFactTabular
            label={labels.escape}
            value={<Times value={ratios.escape} />}
          />
          <VisualFactTabular
            label={labels.orbit}
            value={<Times value={ratios.orbit} />}
          />
          <VisualFactTabular
            label={labels.period}
            value={<Times value={ratios.period} />}
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
