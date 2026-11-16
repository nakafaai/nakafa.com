import { caption } from "@repo/design-system/components/contents/physics/canvas/caption";
import {
  fade,
  gradientRect,
  litBall,
  mix,
  vignette,
} from "@repo/design-system/components/contents/physics/canvas/paint";
import { keplerPeriod } from "@repo/design-system/components/contents/physics/gravity/kepler";
import { hashUnit } from "@repo/design-system/components/contents/simulation/grain";
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
import { MATERIAL } from "@repo/design-system/lib/material";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Array as Arr, Schema } from "effect";
import type p5 from "p5";
import type { ReactNode } from "react";

/** Wall seconds the slower satellite takes for one lap. */
const LAP_SECONDS = 10;

/** One satellite as the sketch draws it: its name, its orbital radius in Earth radii, and its period. */
const SatelliteSchema = Schema.Struct({
  name: Schema.String,
  period: Schema.Finite,
  radius: Schema.Finite,
});

/** What the sketch reads on every frame. */
const OrbitFrameSchema = Schema.Struct({
  satellites: Schema.Array(SatelliteSchema),
});
type OrbitFrame = typeof OrbitFrameSchema.Type;

/**
 * Draws one moment, to scale: the Earth of radius R at the centre, each
 * satellite's circular orbit, its height above the surface beside its
 * radius from the centre, and the satellites moving round at the pace their
 * periods set, the nearer one faster.
 */
function orbitProgram(sketch: p5, read: () => OrbitFrame) {
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
      [0, MATERIAL.nightSky],
      [1, getColor("ZINC", 950)],
    ]);
    sketch.noStroke();
    Arr.forEach(
      Arr.makeBy(160, (index) => index),
      (index) => {
        sketch.fill(fade(getColor("WHITE"), 0.2 + 0.5 * hashUnit(index, 2)));
        sketch.circle(
          hashUnit(index, 0) * width,
          hashUnit(index, 1) * height,
          1 + hashUnit(index, 3) * 1.5
        );
      }
    );
    const centre = { x: width / 2, y: height / 2 };
    const widest = Math.max(
      ...Arr.map(frame.satellites, (satellite) => satellite.radius)
    );
    const earth = (Math.min(width, height) * 0.44) / widest;
    const slowest = Math.max(
      ...Arr.map(frame.satellites, (satellite) => satellite.period)
    );
    litBall(sketch, centre, earth, {
      dark: mix(MATERIAL.waterDeep, getColor("BLACK"), 0.5),
      light: mix(MATERIAL.water, MATERIAL.skyHaze, 0.4),
    });
    Arr.forEach(frame.satellites, (satellite, index) => {
      const ring = satellite.radius * earth;
      const color = index === 0 ? PLOT_COLORS.amber : PLOT_COLORS.teal;
      sketch.noFill();
      sketch.stroke(fade(color, 0.55));
      sketch.strokeWeight(1.5);
      sketch.circle(centre.x, centre.y, ring * 2);
      const angle =
        (clock / LAP_SECONDS) * (slowest / satellite.period) * Math.PI * 2 +
        index * 1.7;
      const at = {
        x: centre.x + Math.cos(angle) * ring,
        y: centre.y - Math.sin(angle) * ring,
      };
      const direction = index === 0 ? 0 : Math.PI;
      sketch.stroke(color);
      sketch.strokeWeight(2);
      sketch.line(
        centre.x,
        centre.y,
        centre.x + Math.cos(direction) * ring,
        centre.y
      );
      sketch.noStroke();
      sketch.fill(color);
      sketch.rect(at.x - 5, at.y - 5, 10, 10, 2);
      caption(
        sketch,
        satellite.name,
        { x: at.x + 9, y: at.y - 9 },
        { align: "left", baseline: "bottom", color, size: 14 }
      );
      caption(
        sketch,
        `${satellite.radius}R`,
        { x: centre.x + Math.cos(direction) * ring * 0.6, y: centre.y - 6 },
        {
          align: "center",
          baseline: "bottom",
          color,
          size: 13,
        }
      );
    });
    vignette(sketch, 0.35);
  };
}

interface OrbitRadiusLabProps {
  description: NonNullable<ReactNode>;
  /** The known satellite's height above the surface, in Earth radii. */
  knownHeight: number;
  /** The known satellite's period, in hours. */
  knownPeriod: number;
  labels: {
    knownName: string;
    knownRadius: ReactNode;
    otherName: string;
    otherPeriod: ReactNode;
    otherRadius: ReactNode;
    viewLabel: string;
  };
  /** The other satellite's height above the surface, in Earth radii. */
  otherHeight: number;
  title: NonNullable<ReactNode>;
}

/**
 * Two satellites in circular orbits round the Earth, drawn to scale. Each
 * one's height is measured from the surface, but Kepler's third law,
 * T² ∝ r³, takes the radius from the Earth's centre: the height plus one
 * Earth radius. The nearer satellite laps faster, at the period the law
 * gives.
 */
export function OrbitRadiusLab({
  description,
  knownHeight,
  knownPeriod,
  labels,
  otherHeight,
  title,
}: OrbitRadiusLabProps) {
  const quantity = useQuantity();
  const known = { period: knownPeriod, radius: knownHeight + 1 };
  const otherRadius = otherHeight + 1;
  const otherPeriod = keplerPeriod(known, otherRadius);

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <VisualCardBody aria-label={labels.viewLabel} render={<section />}>
        <P5Sketch
          label={labels.viewLabel}
          program={orbitProgram}
          state={{
            satellites: [
              {
                name: labels.knownName,
                period: knownPeriod,
                radius: known.radius,
              },
              {
                name: labels.otherName,
                period: otherPeriod,
                radius: otherRadius,
              },
            ],
          }}
        />
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.knownRadius}
            value={<InlineMath math={`${quantity(known.radius, "", 1)}R`} />}
          />
          <VisualFactTabular
            label={labels.otherRadius}
            value={<InlineMath math={`${quantity(otherRadius, "", 1)}R`} />}
          />
          <VisualFactTabular
            label={labels.otherPeriod}
            value={<InlineMath math={quantity(otherPeriod, "\\text{ h}", 2)} />}
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
