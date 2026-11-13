import {
  arrow,
  createBackdrop,
  fade,
  gradientRect,
  mix,
  spotlight,
  vignette,
} from "@repo/design-system/components/contents/physics/canvas/paint";
import { LabSlider } from "@repo/design-system/components/contents/physics/canvas/slider";
import {
  ropeForces,
  type Teams,
  TeamsSchema,
} from "@repo/design-system/components/contents/physics/vector/tug/rope";
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
import { type ReactNode, useState } from "react";

/** How far the ribbon may move from the centre line before the round starts again, as a share of the canvas width. */
const WIN_LINE = 0.12;

/** The sunset sky behind the field, lit low from the horizon. */
function paintSunset(layer: p5) {
  const { height, width } = layer;
  const horizon = height * 0.68;
  gradientRect(layer, { height: horizon, width, x: 0, y: 0 }, [
    [0, mix(MATERIAL.skyZenith, getColor("BLACK"), 0.35)],
    [0.55, mix(MATERIAL.skyHaze, MATERIAL.woolGlow, 0.35)],
    [1, mix(MATERIAL.woolGlow, MATERIAL.headlightGlow, 0.5)],
  ]);
  spotlight(layer, { x: width * 0.62, y: horizon }, height * 0.55, {
    color: MATERIAL.headlightGlow,
    strength: 0.75,
  });
  layer.noStroke();
  layer.fill(fade(MATERIAL.headlightGlow, 0.95));
  layer.circle(width * 0.62, horizon - height * 0.02, height * 0.16);
  layer.fill(mix(MATERIAL.foliageDark, getColor("BLACK"), 0.55));
  layer.beginShape();
  layer.vertex(0, horizon);
  for (let x = 0; x <= width; x += width / 24) {
    layer.vertex(
      x,
      horizon - height * (0.02 + 0.03 * Math.sin(x * 0.013) ** 2)
    );
  }
  layer.vertex(width, height);
  layer.vertex(0, height);
  layer.endShape(layer.CLOSE);
  gradientRect(layer, { height: height - horizon, width, x: 0, y: horizon }, [
    [0, mix(MATERIAL.grass, getColor("BLACK"), 0.55)],
    [1, mix(MATERIAL.grass, getColor("BLACK"), 0.75)],
  ]);
  layer.fill(fade(MATERIAL.roadPaint, 0.55));
  layer.quad(
    width / 2 - 2,
    horizon,
    width / 2 + 2,
    horizon,
    width / 2 + 6,
    height,
    width / 2 - 6,
    height
  );
}

/** One puller in silhouette against the sunset: braced legs with bent knees, a body leaning away from the rope's middle, both hands on the rope. */
function paintPuller(
  sketch: p5,
  at: { x: number; y: number },
  size: number,
  side: -1 | 1
) {
  const ink = getColor("ZINC", 950);
  const hip = { x: at.x + side * size * 0.06, y: at.y - size * 0.46 };
  const shoulder = { x: hip.x + side * size * 0.3, y: hip.y - size * 0.36 };
  const knee = { x: at.x - side * size * 0.14, y: at.y - size * 0.24 };
  const hands = { x: at.x - side * size * 0.22, y: at.y - size * 0.62 };
  sketch.stroke(ink);
  sketch.strokeCap(sketch.ROUND);
  sketch.strokeJoin(sketch.ROUND);
  sketch.strokeWeight(size * 0.09);
  sketch.noFill();
  sketch.beginShape();
  sketch.vertex(hip.x, hip.y);
  sketch.vertex(knee.x, knee.y);
  sketch.vertex(at.x - side * size * 0.3, at.y);
  sketch.endShape();
  sketch.beginShape();
  sketch.vertex(hip.x, hip.y);
  sketch.vertex(knee.x + side * size * 0.12, knee.y + size * 0.02);
  sketch.vertex(at.x - side * size * 0.06, at.y);
  sketch.endShape();
  sketch.strokeWeight(size * 0.07);
  sketch.beginShape();
  sketch.vertex(shoulder.x, shoulder.y + size * 0.04);
  sketch.vertex((shoulder.x + hands.x) / 2, hands.y + size * 0.03);
  sketch.vertex(hands.x, hands.y);
  sketch.endShape();
  sketch.noStroke();
  sketch.fill(ink);
  sketch.quad(
    hip.x - size * 0.09,
    hip.y + size * 0.03,
    hip.x + size * 0.08,
    hip.y + size * 0.03,
    shoulder.x + size * 0.1,
    shoulder.y,
    shoulder.x - size * 0.1,
    shoulder.y - size * 0.02
  );
  sketch.ellipse(at.x - side * size * 0.33, at.y, size * 0.14, size * 0.05);
  sketch.ellipse(at.x - side * size * 0.09, at.y, size * 0.14, size * 0.05);
  sketch.circle(
    shoulder.x + side * size * 0.07,
    shoulder.y - size * 0.11,
    size * 0.17
  );
}

/**
 * Draws the match at sunset: the two teams in silhouette, the rope with its
 * red ribbon that drifts toward the stronger team, the two teams' pulls
 * (teal left, amber right) and the net force (violet) under the ribbon.
 */
function tugProgram(sketch: p5, read: () => { readonly teams: Teams }) {
  const backdrop = createBackdrop();
  let shift = 0;
  let rest = 0;
  sketch.setup = () => {
    sketch.createCanvas(1, 1);
  };
  sketch.draw = () => {
    const { teams } = read();
    const forces = ropeForces(teams);
    backdrop(sketch, "sunset", paintSunset);
    const { height, width } = sketch;
    const floor = height * 0.86;
    const size = height * 0.3;
    if (sketch.isLooping()) {
      const step = Math.min(sketch.deltaTime / 1000, 0.1);
      if (Math.abs(shift) >= width * WIN_LINE) {
        rest += step;
        if (rest > 1.2) {
          shift = 0;
          rest = 0;
        }
      } else {
        shift += (forces.net / Math.max(teams.pull, 1)) * width * 0.025 * step;
      }
    }
    if (forces.net === 0) {
      shift = 0;
    }
    const middle = width / 2 + shift;
    const hand = floor - size * 0.62;
    sketch.stroke(mix(MATERIAL.hemp, getColor("BLACK"), 0.45));
    sketch.strokeWeight(Math.max(3, size * 0.04));
    sketch.line(middle - width * 0.46, hand, middle + width * 0.46, hand);
    for (let index = 0; index < teams.left; index += 1) {
      paintPuller(
        sketch,
        { x: middle - width * (0.1 + index * 0.05), y: floor },
        size,
        -1
      );
    }
    for (let index = 0; index < teams.right; index += 1) {
      paintPuller(
        sketch,
        { x: middle + width * (0.1 + index * 0.05), y: floor },
        size,
        1
      );
    }
    sketch.noStroke();
    sketch.fill(MATERIAL.signalRed);
    sketch.triangle(
      middle - 6,
      hand,
      middle + 6,
      hand,
      middle,
      hand + size * 0.22
    );
    const scale = (width * 0.4) / (8 * teams.pull);
    const top = height * 0.16;
    const head = Math.max(10, height * 0.035);
    arrow(
      sketch,
      { x: width / 2, y: top },
      { x: width / 2 + forces.left * scale, y: top },
      { color: PLOT_COLORS.teal, head, weight: 4 }
    );
    arrow(
      sketch,
      { x: width / 2, y: top },
      { x: width / 2 + forces.right * scale, y: top },
      { color: PLOT_COLORS.amber, head, weight: 4 }
    );
    arrow(
      sketch,
      { x: width / 2, y: top + head * 2.2 },
      { x: width / 2 + forces.net * scale, y: top + head * 2.2 },
      { color: PLOT_COLORS.violet, head, weight: 4.5 }
    );
    sketch.fill(PLOT_COLORS.violet);
    sketch.circle(width / 2, top + head * 2.2, head * 0.55);
    vignette(sketch, 0.35);
  };
}

interface TugOfWarForceLabProps {
  description: ReactNode;
  labels: {
    left: ReactNode;
    leftCount: ReactNode;
    leftName: string;
    net: ReactNode;
    right: ReactNode;
    rightCount: ReactNode;
    rightName: string;
    viewLabel: string;
  };
  /** The pullers on the left team at the start. */
  left: number;
  /** One puller's pull, in newtons. */
  pull: number;
  /** The pullers on the right team at the start. */
  right: number;
  title: ReactNode;
}

/**
 * A tug of war at sunset. The learner sets how many pull on each side: a
 * team's force is that many times one pull, the left team's points the
 * opposite way, and the net force on the rope is their sum, the zero vector
 * when the teams match.
 */
export function TugOfWarForceLab({
  description,
  labels,
  left: startLeft,
  pull,
  right: startRight,
  title,
}: TugOfWarForceLabProps) {
  const quantity = useQuantity();
  const [left, setLeft] = useState(startLeft);
  const [right, setRight] = useState(startRight);
  const teams = Schema.decodeUnknownSync(TeamsSchema)({ left, pull, right });
  const forces = ropeForces(teams);

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <VisualCardToolbar>
        <div className="grid w-full gap-4 sm:grid-cols-2">
          <LabSlider
            label={labels.leftCount}
            max={8}
            min={1}
            name={labels.leftName}
            onValueChange={setLeft}
            readout={<InlineMath math={`${left}`} />}
            step={1}
            value={left}
          />
          <LabSlider
            label={labels.rightCount}
            max={8}
            min={1}
            name={labels.rightName}
            onValueChange={setRight}
            readout={<InlineMath math={`${right}`} />}
            step={1}
            value={right}
          />
        </div>
      </VisualCardToolbar>
      <VisualCardBody aria-label={labels.viewLabel} render={<section />}>
        <P5Sketch
          label={labels.viewLabel}
          program={tugProgram}
          state={{ teams }}
        />
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.left}
            value={<InlineMath math={quantity(forces.left, "\\text{ N}", 0)} />}
          />
          <VisualFactTabular
            label={labels.right}
            value={
              <InlineMath math={quantity(forces.right, "\\text{ N}", 0)} />
            }
          />
          <VisualFactTabular
            label={labels.net}
            value={<InlineMath math={quantity(forces.net, "\\text{ N}", 0)} />}
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
