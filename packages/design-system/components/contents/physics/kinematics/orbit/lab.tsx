import {
  arrow,
  createBackdrop,
  fade,
  gradientRect,
  litBall,
  mix,
  spotlight,
  vignette,
} from "@repo/design-system/components/contents/physics/canvas/paint";
import {
  EARTH_RADIUS,
  type Orbit,
  OrbitSchema,
  orbitMotion,
} from "@repo/design-system/components/contents/physics/kinematics/orbit/satellite";
import { hashUnit } from "@repo/design-system/components/contents/simulation/grain";
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
import { MATERIAL } from "@repo/design-system/lib/material";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Array as Arr, Schema } from "effect";
import type p5 from "p5";
import { type ReactNode, useState } from "react";

/** Every orbit plays one lap in this many wall seconds, whatever its real period. */
const LAP_SECONDS = 8;

/** What the sketch reads on every frame. */
const OrbitFrameSchema = Schema.Struct({
  orbit: OrbitSchema,
});
type OrbitFrame = typeof OrbitFrameSchema.Type;

/** Space: black with a scatter of faint stars that never move. */
function paintSpace(sketch: p5) {
  gradientRect(
    sketch,
    { height: sketch.height, width: sketch.width, x: 0, y: 0 },
    [
      [0, mix(getColor("ZINC", 950), getColor("SLATE", 800), 0.25)],
      [1, getColor("ZINC", 950)],
    ]
  );
  sketch.noStroke();
  for (let index = 0; index < 220; index += 1) {
    sketch.fill(fade(getColor("WHITE"), 0.25 + 0.6 * hashUnit(index, 2)));
    sketch.circle(
      hashUnit(index, 0) * sketch.width,
      hashUnit(index, 1) * sketch.height,
      0.6 + 1.6 * hashUnit(index, 3)
    );
  }
}

/** The Earth from far away: oceans, land and cloud, lit from the left, with a thin atmosphere. */
function paintEarth(
  sketch: p5,
  centre: { readonly x: number; readonly y: number },
  radius: number
) {
  spotlight(sketch, centre, radius * 1.15, {
    color: MATERIAL.skyZenith,
    strength: 0.5,
  });
  litBall(sketch, centre, radius, {
    dark: mix(MATERIAL.waterDeep, getColor("BLACK"), 0.6),
    light: mix(MATERIAL.water, MATERIAL.skyHaze, 0.3),
  });
  sketch.noStroke();
  for (let index = 0; index < 26; index += 1) {
    const angle = hashUnit(index, 4) * Math.PI * 2;
    const reach = Math.sqrt(hashUnit(index, 5)) * radius * 0.78;
    const x = centre.x + Math.cos(angle) * reach;
    const y = centre.y + Math.sin(angle) * reach;
    const shade = Math.max(0.15, 1 - (x - centre.x + radius) / (2 * radius));
    sketch.fill(
      fade(
        index % 3 === 0 ? MATERIAL.riverbank : MATERIAL.foliage,
        0.55 * shade + 0.1
      )
    );
    sketch.ellipse(
      x,
      y,
      radius * (0.12 + 0.2 * hashUnit(index, 6)),
      radius * (0.08 + 0.14 * hashUnit(index, 7))
    );
    sketch.fill(fade(getColor("WHITE"), 0.35 * shade));
    sketch.ellipse(
      x + radius * 0.08,
      y - radius * 0.05,
      radius * (0.2 + 0.25 * hashUnit(index, 8)),
      radius * 0.04
    );
  }
}

/**
 * Draws one moment of the orbit, the Earth and the ring at the same scale,
 * zoomed so the ring fills the frame: the Earth, the orbit as a faint
 * ring, the satellite, its velocity along the ring, and its acceleration,
 * which is gravity, pointing at the Earth's centre.
 */
function orbitProgram(sketch: p5, read: () => OrbitFrame) {
  let clock = 0;
  const backdrop = createBackdrop();
  sketch.setup = () => {
    sketch.createCanvas(1, 1);
  };
  sketch.draw = () => {
    const { orbit } = read();
    if (sketch.isLooping()) {
      clock += Math.min(sketch.deltaTime / 1000, 0.1) / LAP_SECONDS;
    }
    const motion = orbitMotion(orbit);
    const scale =
      (Math.min(sketch.width, sketch.height) * 0.42) / motion.radius;
    const centre = { x: sketch.width / 2, y: sketch.height / 2 };
    backdrop(sketch, orbit, (layer) => {
      paintSpace(layer);
      paintEarth(layer, centre, EARTH_RADIUS * scale);
    });
    const ring = motion.radius * scale;
    sketch.noFill();
    sketch.stroke(fade(getColor("WHITE"), 0.25));
    sketch.strokeWeight(1.2);
    sketch.circle(centre.x, centre.y, ring * 2);
    const angle = clock * Math.PI * 2;
    const at = {
      x: centre.x + Math.cos(angle) * ring,
      y: centre.y - Math.sin(angle) * ring,
    };
    const length = Math.min(sketch.width, sketch.height) * 0.14;
    arrow(
      sketch,
      at,
      {
        x: at.x - Math.sin(angle) * length,
        y: at.y - Math.cos(angle) * length,
      },
      { color: PLOT_COLORS.teal, head: 11, weight: 3 }
    );
    arrow(
      sketch,
      at,
      {
        x: at.x - Math.cos(angle) * length * 0.8,
        y: at.y + Math.sin(angle) * length * 0.8,
      },
      { color: PLOT_COLORS.fuchsia, head: 11, weight: 3 }
    );
    sketch.noStroke();
    spotlight(sketch, at, 14, { color: MATERIAL.headlightGlow, strength: 0.6 });
    sketch.fill(MATERIAL.chrome);
    sketch.rect(at.x - 3, at.y - 3, 6, 6);
    sketch.fill(mix(MATERIAL.tintedGlass, PLOT_COLORS.violet, 0.3));
    sketch.rect(at.x - 13, at.y - 2, 8, 4);
    sketch.rect(at.x + 5, at.y - 2, 8, 4);
    vignette(sketch, 0.35);
  };
}

interface SatelliteOrbitCircularLabProps {
  description: ReactNode;
  labels: {
    acceleration: ReactNode;
    chooseOrbit: string;
    orbits: Record<Orbit, ReactNode>;
    period: ReactNode;
    radius: ReactNode;
    speed: ReactNode;
    viewLabel: string;
  };
  title: ReactNode;
}

/**
 * Three real satellites in circular orbits drawn to scale around the
 * Earth: the space station, a GPS satellite, and a geostationary one. Each
 * moves at constant speed along its circle while gravity, pointing at the
 * Earth's centre, supplies its centripetal acceleration v² / r.
 */
export function SatelliteOrbitCircularLab({
  description,
  labels,
  title,
}: SatelliteOrbitCircularLabProps) {
  const [orbit, setOrbit] = useState<Orbit>("station");
  const quantity = useQuantity();
  const motion = orbitMotion(orbit);
  const isOrbit = Schema.is(OrbitSchema);
  const hours = motion.period / 3600;

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <VisualCardToolbar>
        <ToggleGroup
          aria-label={labels.chooseOrbit}
          gridColumns="3"
          onValueChange={(value) => {
            if (isOrbit(value)) {
              setOrbit(value);
            }
          }}
          type="single"
          value={orbit}
          variant="outline"
        >
          {Arr.map(OrbitSchema.literals, (option) => (
            <ToggleGroupItem key={option} value={option}>
              {labels.orbits[option]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </VisualCardToolbar>
      <VisualCardBody aria-label={labels.viewLabel} render={<section />}>
        <P5Sketch
          label={labels.viewLabel}
          program={orbitProgram}
          state={{ orbit }}
        />
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.radius}
            value={
              <InlineMath
                math={quantity(motion.radius / 1000, "\\text{ km}", 0)}
              />
            }
          />
          <VisualFactTabular
            label={labels.speed}
            value={
              <InlineMath
                math={quantity(motion.speed / 1000, "\\text{ km/s}", 2)}
              />
            }
          />
          <VisualFactTabular
            label={labels.period}
            value={
              <InlineMath
                math={
                  hours < 2
                    ? quantity(motion.period / 60, "\\text{ min}", 1)
                    : quantity(hours, "\\text{ h}", 2)
                }
              />
            }
          />
          <VisualFactTabular
            label={labels.acceleration}
            value={
              <InlineMath
                math={quantity(motion.acceleration, "\\text{ m/s}^2", 2)}
              />
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
