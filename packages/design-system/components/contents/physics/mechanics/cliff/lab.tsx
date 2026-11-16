import { caption } from "@repo/design-system/components/contents/physics/canvas/caption";
import {
  dashed,
  fade,
  gradientRect,
  litBall,
  mix,
  vignette,
} from "@repo/design-system/components/contents/physics/canvas/paint";
import {
  cliffDrop,
  heightOfThrown,
} from "@repo/design-system/components/contents/physics/mechanics/force";
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
import { Schema } from "effect";
import type p5 from "p5";
import type { ReactNode } from "react";

/** Wall seconds per second of the fall: the balls fall at their real pace. */
const PACE = 1;

/** Wall seconds the scene holds after both balls land. */
const HOLD_SECONDS = 1.5;

/** What the sketch reads on every frame. */
const CliffFrameSchema = Schema.Struct({
  delay: Schema.Finite,
  gravity: Schema.Finite,
  height: Schema.Finite,
  speed: Schema.Finite,
});
type CliffFrame = typeof CliffFrameSchema.Type;

/**
 * Draws one moment: the cliff with its edge above the sea, ball A rising and
 * falling past the edge, ball B released from rest at the edge after its
 * delay, and a mark every 5 m up the cliff face.
 */
function cliffProgram(sketch: p5, read: () => CliffFrame) {
  let clock = 0;
  sketch.setup = () => {
    sketch.createCanvas(1, 1);
  };
  sketch.draw = () => {
    const frame = read();
    const drop = cliffDrop(frame);
    const last = Math.max(drop.first, drop.second);
    if (sketch.isLooping()) {
      clock =
        (clock + Math.min(sketch.deltaTime / 1000, 0.1) / PACE) %
        (last + HOLD_SECONDS);
    }
    const { height, width } = sketch;
    const sea = height * 0.88;
    const metre = (height * 0.76) / drop.peak;
    const edge = sea - frame.height * metre;
    gradientRect(sketch, { height: sea, width, x: 0, y: 0 }, [
      [0, MATERIAL.skyZenith],
      [1, MATERIAL.skyHaze],
    ]);
    gradientRect(sketch, { height: height - sea, width, x: 0, y: sea }, [
      [0, MATERIAL.seawater],
      [1, MATERIAL.seawaterDeep],
    ]);
    sketch.noStroke();
    sketch.fill(mix(MATERIAL.rock, getColor("BLACK"), 0.1));
    sketch.rect(0, edge, width * 0.4, sea - edge);
    sketch.fill(mix(MATERIAL.foliage, getColor("BLACK"), 0.1));
    sketch.rect(0, edge - 6, width * 0.4, 8);
    sketch.stroke(fade(getColor("WHITE"), 0.55));
    sketch.strokeWeight(1);
    for (let mark = 0; mark <= frame.height; mark += 5) {
      const y = sea - mark * metre;
      sketch.line(width * 0.36, y, width * 0.4, y);
    }
    dashed(
      sketch,
      { x: width * 0.4, y: edge },
      { x: width * 0.95, y: edge },
      { color: fade(getColor("WHITE"), 0.5), dash: 5, weight: 1 }
    );
    // A strobe of each ball every quarter second, so a still frame shows both journeys.
    sketch.noStroke();
    for (let tick = 0; tick * 0.25 <= drop.first; tick += 1) {
      sketch.fill(fade(PLOT_COLORS.pink, 0.35));
      sketch.circle(
        width * 0.56,
        sea - Math.max(heightOfThrown(frame, tick * 0.25), 0) * metre - 7,
        6
      );
    }
    for (let tick = 0; frame.delay + tick * 0.25 <= drop.second; tick += 1) {
      sketch.fill(fade(PLOT_COLORS.teal, 0.35));
      sketch.circle(
        width * 0.76,
        sea -
          Math.max(frame.height - 0.5 * frame.gravity * (tick * 0.25) ** 2, 0) *
            metre -
          7,
        6
      );
    }
    const a = Math.max(heightOfThrown(frame, Math.min(clock, drop.first)), 0);
    const bTime = Math.min(
      Math.max(clock - frame.delay, 0),
      drop.second - frame.delay
    );
    const b = Math.max(frame.height - 0.5 * frame.gravity * bTime ** 2, 0);
    const radius = Math.max(7, width * 0.018);
    litBall(sketch, { x: width * 0.56, y: sea - a * metre - radius }, radius, {
      dark: mix(PLOT_COLORS.pink, getColor("BLACK"), 0.4),
      light: mix(PLOT_COLORS.pink, getColor("WHITE"), 0.4),
    });
    litBall(sketch, { x: width * 0.76, y: sea - b * metre - radius }, radius, {
      dark: mix(PLOT_COLORS.teal, getColor("BLACK"), 0.4),
      light: mix(PLOT_COLORS.teal, getColor("WHITE"), 0.4),
    });
    const name = {
      align: "center",
      baseline: "bottom",
      color: getColor("WHITE"),
      size: 14,
    } as const;
    caption(
      sketch,
      "A",
      { x: width * 0.56, y: sea - a * metre - radius * 2.4 },
      name
    );
    caption(
      sketch,
      "B",
      { x: width * 0.76, y: sea - b * metre - radius * 2.4 },
      name
    );
    vignette(sketch, 0.25);
  };
}

interface CliffThrowLabProps {
  /** How long after A's throw B is released, in seconds. */
  delay: number;
  description: ReactNode;
  /** The gravitational acceleration, in m s⁻². */
  gravity: number;
  /** The height of the cliff edge above the sea, in metres. */
  height: number;
  labels: {
    first: ReactNode;
    gap: ReactNode;
    second: ReactNode;
    viewLabel: string;
  };
  /** The speed ball A is thrown straight up at, in m s⁻¹. */
  speed: number;
  title: ReactNode;
}

/**
 * Two balls leave a cliff edge above the sea: A thrown straight up, B dropped
 * from rest a little later. A spends time rising and coming back down past
 * the edge, so B can reach the sea first even though it starts later. Both
 * times run from the moment A is thrown.
 */
export function CliffThrowLab({
  delay,
  description,
  gravity,
  height,
  labels,
  speed,
  title,
}: CliffThrowLabProps) {
  const quantity = useQuantity();
  const drop = cliffDrop({ delay, gravity, height, speed });

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <VisualCardBody aria-label={labels.viewLabel} render={<section />}>
        <P5Sketch
          label={labels.viewLabel}
          program={cliffProgram}
          state={{ delay, gravity, height, speed }}
        />
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.first}
            value={<InlineMath math={quantity(drop.first, "\\text{ s}", 2)} />}
          />
          <VisualFactTabular
            label={labels.second}
            value={<InlineMath math={quantity(drop.second, "\\text{ s}", 2)} />}
          />
          <VisualFactTabular
            label={labels.gap}
            value={
              <InlineMath
                math={quantity(
                  Math.abs(drop.first - drop.second),
                  "\\text{ s}",
                  2
                )}
              />
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
