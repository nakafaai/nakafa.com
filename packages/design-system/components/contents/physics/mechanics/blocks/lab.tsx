import { vignette } from "@repo/design-system/components/contents/physics/canvas/paint";
import { LabSlider } from "@repo/design-system/components/contents/physics/canvas/slider";
import { connectedBlocks } from "@repo/design-system/components/contents/physics/mechanics/force";
import {
  force,
  paintBlock,
  paintRoom,
} from "@repo/design-system/components/contents/physics/mechanics/stage";
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
import { MATERIAL } from "@repo/design-system/lib/material";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Schema } from "effect";
import type p5 from "p5";
import { type ReactNode, useState } from "react";

/** Wall seconds a run lasts before the blocks start again from the left. */
const RUN_SECONDS = 3;

/** What the sketch reads on every frame. */
const BlocksFrameSchema = Schema.Struct({
  acceleration: Schema.Finite,
  back: Schema.Finite,
  friction: Schema.Finite,
  front: Schema.Finite,
  pull: Schema.Finite,
  tension: Schema.Finite,
});
type BlocksFrame = typeof BlocksFrameSchema.Type;

/**
 * Draws one moment: the two blocks joined by the string, speeding up across
 * the floor from rest, the pull on the front block, the tension pulling each
 * block toward the other, and the friction on the back block, each arrow as
 * long as its force.
 */
function blocksProgram(sketch: p5, read: () => BlocksFrame) {
  let clock = 0;
  sketch.setup = () => {
    sketch.createCanvas(1, 1);
  };
  sketch.draw = () => {
    const frame = read();
    if (sketch.isLooping()) {
      clock = (clock + Math.min(sketch.deltaTime / 1000, 0.1)) % RUN_SECONDS;
    }
    const { height, width } = sketch;
    const floor = height * 0.66;
    paintRoom(sketch, floor);
    const travel = Math.max(0, frame.acceleration) * 0.5 * clock ** 2;
    const shift = Math.min(
      (travel / (Math.max(frame.acceleration, 0.1) * 0.5 * RUN_SECONDS ** 2)) *
        width *
        0.18,
      width * 0.18
    );
    const unit = Math.min(width, height) * 0.1;
    const backSize = unit * Math.cbrt(frame.back) * 1.3;
    const frontSize = unit * Math.cbrt(frame.front) * 1.3;
    const backLeft = width * 0.08 + shift;
    const gap = width * 0.18;
    const frontLeft = backLeft + backSize + gap;
    const string = floor - Math.min(backSize, frontSize) * 0.5;
    sketch.stroke(MATERIAL.hemp);
    sketch.strokeWeight(3);
    sketch.line(backLeft + backSize, string, frontLeft, string);
    paintBlock(
      sketch,
      { base: floor, height: backSize, left: backLeft, width: backSize },
      MATERIAL.oak
    );
    paintBlock(
      sketch,
      { base: floor, height: frontSize, left: frontLeft, width: frontSize },
      MATERIAL.pine
    );
    const newton = (width * 0.16) / Math.max(frame.pull, 1);
    const pullFrom = { x: frontLeft + frontSize, y: string };
    force(
      sketch,
      pullFrom,
      { x: pullFrom.x + frame.pull * newton, y: string },
      PLOT_COLORS.pink,
      "F"
    );
    force(
      sketch,
      { x: frontLeft, y: string - 12 },
      { x: frontLeft - frame.tension * newton, y: string - 12 },
      PLOT_COLORS.teal,
      "T"
    );
    force(
      sketch,
      { x: backLeft + backSize, y: string + 12 },
      { x: backLeft + backSize + frame.tension * newton, y: string + 12 },
      PLOT_COLORS.teal,
      "T"
    );
    force(
      sketch,
      { x: backLeft + backSize / 2, y: floor + 6 },
      { x: backLeft + backSize / 2 - frame.friction * newton, y: floor + 6 },
      PLOT_COLORS.orange,
      "f"
    );
    vignette(sketch, 0.3);
  };
}

interface ConnectedBlocksLabProps {
  /** The mass of the back block, in kilograms. */
  back: number;
  description: NonNullable<ReactNode>;
  /** The friction on the back block, in newtons. */
  friction: number;
  /** The mass of the front block, in kilograms. */
  front: number;
  labels: {
    acceleration: ReactNode;
    pull: ReactNode;
    pullName: string;
    tension: ReactNode;
    viewLabel: string;
  };
  /** The pull on the front block, in newtons. */
  pull: number;
  title: NonNullable<ReactNode>;
}

/**
 * Two blocks joined by a light string are pulled across the floor from the
 * front. Taken together, the string's tension is internal, so the pull less
 * the friction accelerates both; taken alone, the back block is pulled only
 * by the string, which must overcome its friction and accelerate it. Change
 * the pull and watch the tension follow.
 */
export function ConnectedBlocksLab({
  back,
  description,
  friction,
  front,
  labels,
  pull: start,
  title,
}: ConnectedBlocksLabProps) {
  const quantity = useQuantity();
  const [pull, setPull] = useState(start);
  const blocks = connectedBlocks({ back, friction, front, pull });

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <VisualCardToolbar>
        <LabSlider
          label={<span>{labels.pull}</span>}
          max={Math.max(40, start * 2)}
          min={Math.ceil(friction)}
          name={labels.pullName}
          onValueChange={setPull}
          readout={<InlineMath math={quantity(pull, "\\text{ N}", 0)} />}
          step={1}
          value={pull}
        />
      </VisualCardToolbar>
      <VisualCardBody aria-label={labels.viewLabel} render={<section />}>
        <P5Sketch
          label={labels.viewLabel}
          program={blocksProgram}
          state={{
            acceleration: blocks.acceleration,
            back,
            friction,
            front,
            pull,
            tension: blocks.tension,
          }}
        />
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.acceleration}
            value={
              <InlineMath
                math={quantity(blocks.acceleration, "\\text{ m s}^{-2}", 2)}
              />
            }
          />
          <VisualFactTabular
            label={labels.tension}
            value={
              <InlineMath math={quantity(blocks.tension, "\\text{ N}", 2)} />
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
