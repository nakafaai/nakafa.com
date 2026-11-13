import {
  advanceRun,
  shownTime,
} from "@repo/design-system/components/contents/physics/canvas/clock";
import {
  arrow,
  createBackdrop,
  dashed,
  fade,
  gradientRect,
  mix,
  vignette,
} from "@repo/design-system/components/contents/physics/canvas/paint";
import { LabSlider } from "@repo/design-system/components/contents/physics/canvas/slider";
import {
  fitPlan,
  type Plan,
  planPoint,
} from "@repo/design-system/components/contents/physics/canvas/town";
import {
  type River,
  RiverSchema,
  riverCrossing,
} from "@repo/design-system/components/contents/physics/kinematics/river/crossing";
import { hashUnit } from "@repo/design-system/components/contents/simulation/grain";
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
import { MATERIAL } from "@repo/design-system/lib/material";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Schema } from "effect";
import type p5 from "p5";
import { type ReactNode, useMemo, useState } from "react";

/** How long one crossing plays, in wall seconds. */
const PLAY_SECONDS = 6;

/** How long the boat rests on the far bank before it crosses again, in wall seconds. */
const HOLD_SECONDS = 1.5;

/** What the sketch reads on every frame: the river and the boat's heading. */
interface RiverFrame {
  readonly heading: number;
  readonly river: River;
}

/** The plan that fits both banks and the widest drift a heading can give. */
function riverPlan(sketch: p5, river: River): Plan {
  const reach = river.width * 0.9;
  return fitPlan(
    sketch,
    { east: [-reach, reach], north: [-river.width * 0.22, river.width * 1.22] },
    0
  );
}

/** The two banks, the water between them, and trees along the grass. */
function paintRiver(sketch: p5, plan: Plan, river: River) {
  const south = planPoint(plan, { east: 0, north: 0 }).y;
  const north = planPoint(plan, { east: 0, north: river.width }).y;
  const bank = river.width * 0.06 * plan.scale;
  gradientRect(
    sketch,
    { height: sketch.height, width: sketch.width, x: 0, y: 0 },
    [
      [0, mix(MATERIAL.grass, MATERIAL.foliageLight, 0.3)],
      [1, mix(MATERIAL.grass, MATERIAL.foliageDark, 0.35)],
    ]
  );
  sketch.noStroke();
  sketch.fill(MATERIAL.riverbank);
  sketch.rect(0, north - bank, sketch.width, south - north + 2 * bank);
  gradientRect(
    sketch,
    { height: south - north, width: sketch.width, x: 0, y: north },
    [
      [0, MATERIAL.water],
      [0.5, MATERIAL.waterDeep],
      [1, MATERIAL.water],
    ]
  );
  for (let index = 0; index < 28; index += 1) {
    const x = hashUnit(index, 1) * sketch.width;
    const top = hashUnit(index, 2) < 0.5;
    const y = top
      ? north - bank - hashUnit(index, 3) * (north - bank)
      : south + bank + hashUnit(index, 3) * (sketch.height - south - bank);
    const radius =
      (4 + hashUnit(index, 4) * 6) *
      Math.max(plan.scale * river.width * 0.01, 1);
    sketch.fill(fade(getColor("BLACK"), 0.3));
    sketch.circle(x + radius * 0.3, y + radius * 0.3, radius * 2.1);
    sketch.fill(MATERIAL.foliageDark);
    sketch.circle(x, y, radius * 2);
    sketch.fill(MATERIAL.foliageLight);
    sketch.circle(x - radius * 0.25, y - radius * 0.25, radius * 1.2);
  }
}

/** Streaks on the water that drift east with the current. */
function paintCurrent(sketch: p5, plan: Plan, river: River, clock: number) {
  const south = planPoint(plan, { east: 0, north: 0 }).y;
  const north = planPoint(plan, { east: 0, north: river.width }).y;
  sketch.push();
  sketch.stroke(fade(MATERIAL.waterGlint, 0.35));
  sketch.strokeWeight(1.5);
  for (let index = 0; index < 40; index += 1) {
    const y = north + (south - north) * (0.05 + 0.9 * hashUnit(index, 9));
    const length = 12 + 18 * hashUnit(index, 10);
    const travel =
      (hashUnit(index, 11) * sketch.width +
        river.current * plan.scale * clock) %
      (sketch.width + length);
    sketch.line(travel - length, y, travel, y);
  }
  sketch.pop();
}

/** The boat, seen from above, pointing along its heading. */
function paintBoat(
  sketch: p5,
  at: { readonly x: number; readonly y: number },
  heading: number,
  size: number
) {
  sketch.push();
  sketch.translate(at.x, at.y);
  sketch.rotate((heading * Math.PI) / 180);
  sketch.noStroke();
  sketch.fill(fade(getColor("BLACK"), 0.35));
  sketch.ellipse(size * 0.12, size * 0.12, size * 0.55, size * 1.25);
  sketch.fill(MATERIAL.dish);
  sketch.beginShape();
  sketch.vertex(0, -size * 0.62);
  sketch.vertex(size * 0.24, -size * 0.1);
  sketch.vertex(size * 0.22, size * 0.55);
  sketch.vertex(-size * 0.22, size * 0.55);
  sketch.vertex(-size * 0.24, -size * 0.1);
  sketch.endShape(sketch.CLOSE);
  sketch.fill(PLOT_COLORS.orange);
  sketch.rect(-size * 0.2, size * 0.05, size * 0.4, size * 0.12);
  sketch.fill(MATERIAL.tintedGlass);
  sketch.rect(-size * 0.14, -size * 0.18, size * 0.28, size * 0.16, 2);
  sketch.pop();
}

/**
 * Draws one moment of the crossing from above: the water carries its
 * streaks east, the boat points where it heads but moves along the sum of
 * its own velocity and the current, drawn tip to tail at the boat.
 */
function riverProgram(sketch: p5, read: () => RiverFrame) {
  let time = Number.POSITIVE_INFINITY;
  let clock = 0;
  const backdrop = createBackdrop();
  sketch.setup = () => {
    sketch.createCanvas(1, 1);
  };
  sketch.draw = () => {
    const { heading, river } = read();
    const crossing = riverCrossing(river, heading);
    const plan = riverPlan(sketch, river);
    backdrop(sketch, `${river.width}`, (layer) =>
      paintRiver(layer, plan, river)
    );
    if (sketch.isLooping()) {
      clock += Math.min(sketch.deltaTime / 1000, 0.1) * 2;
    }
    paintCurrent(sketch, plan, river, clock);
    if (!crossing) {
      vignette(sketch, 0.3);
      return;
    }
    if (sketch.isLooping()) {
      time = advanceRun(
        Math.min(time, crossing.time * 2),
        sketch.deltaTime / 1000,
        {
          duration: crossing.time,
          hold: HOLD_SECONDS,
          rate: crossing.time / PLAY_SECONDS,
        }
      );
    }
    const now = shownTime(time, crossing.time);
    const start = planPoint(plan, { east: 0, north: 0 });
    const landing = planPoint(plan, {
      east: crossing.drift,
      north: river.width,
    });
    dashed(sketch, start, landing, {
      color: fade(getColor("WHITE"), 0.55),
      dash: 7,
      weight: 2,
    });
    const boat = planPoint(plan, {
      east: crossing.downstream * now,
      north: crossing.across * now,
    });
    const scale = river.width * 0.07 * plan.scale;
    const head = Math.max(10, scale * 0.35);
    const ownTip = {
      x: boat.x + Math.sin((heading * Math.PI) / 180) * river.boatSpeed * scale,
      y: boat.y - Math.cos((heading * Math.PI) / 180) * river.boatSpeed * scale,
    };
    paintBoat(
      sketch,
      boat,
      heading,
      Math.max(18, river.width * 0.09 * plan.scale)
    );
    arrow(sketch, boat, ownTip, { color: PLOT_COLORS.teal, head, weight: 3.5 });
    arrow(
      sketch,
      ownTip,
      { x: ownTip.x + river.current * scale, y: ownTip.y },
      { color: PLOT_COLORS.amber, head, weight: 3.5 }
    );
    arrow(
      sketch,
      boat,
      {
        x: boat.x + crossing.downstream * scale,
        y: boat.y - crossing.across * scale,
      },
      { color: PLOT_COLORS.violet, head, weight: 4 }
    );
    vignette(sketch, 0.3);
  };
}

interface RiverBoatCrossingLabProps {
  /** The boat's speed through the water, in m/s. */
  boatSpeed: number;
  /** The speed of the current, in m/s. */
  current: number;
  description: ReactNode;
  /** The heading the boat starts with, in degrees from straight across, negative upstream. */
  heading?: number;
  labels: {
    angle: ReactNode;
    drift: ReactNode;
    groundSpeed: ReactNode;
    heading: ReactNode;
    headingName: string;
    time: ReactNode;
    viewLabel: string;
  };
  title: ReactNode;
  /** The width of the river, in metres. */
  width: number;
}

/**
 * A boat crossing a flowing river, seen from above. The learner turns the
 * boat's heading: its own velocity (teal) and the current (amber) add tip to
 * tail into its velocity over the ground (violet), which sets how long the
 * crossing takes and how far downstream it lands.
 */
export function RiverBoatCrossingLab({
  boatSpeed,
  current,
  description,
  heading: initial = 0,
  labels,
  title,
  width,
}: RiverBoatCrossingLabProps) {
  const [heading, setHeading] = useState(initial);
  const quantity = useQuantity();
  const river = useMemo(
    () => Schema.decodeUnknownSync(RiverSchema)({ boatSpeed, current, width }),
    [boatSpeed, current, width]
  );
  const crossing = riverCrossing(river, heading);

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <VisualCardToolbar>
        <LabSlider
          label={labels.heading}
          max={60}
          min={-60}
          name={labels.headingName}
          onValueChange={setHeading}
          readout={<InlineMath math={`${quantity(heading, "^\\circ", 0)}`} />}
          step={1}
          value={heading}
        />
      </VisualCardToolbar>
      <VisualCardBody aria-label={labels.viewLabel} render={<section />}>
        <P5Sketch
          label={labels.viewLabel}
          program={riverProgram}
          state={{ heading, river }}
        />
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.groundSpeed}
            value={
              <InlineMath
                math={quantity(crossing?.speed ?? 0, "\\text{ m/s}", 2)}
              />
            }
          />
          <VisualFactTabular
            label={labels.angle}
            value={
              <InlineMath math={quantity(crossing?.angle ?? 0, "^\\circ", 1)} />
            }
          />
          <VisualFactTabular
            label={labels.time}
            value={
              <InlineMath
                math={quantity(crossing?.time ?? 0, "\\text{ s}", 1)}
              />
            }
          />
          <VisualFactTabular
            label={labels.drift}
            value={
              <InlineMath
                math={quantity(crossing?.drift ?? 0, "\\text{ m}", 1)}
              />
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
