import {
  arrow,
  createBackdrop,
  fade,
  vignette,
} from "@repo/design-system/components/contents/physics/canvas/paint";
import { LabSlider } from "@repo/design-system/components/contents/physics/canvas/slider";
import { paintSea } from "@repo/design-system/components/contents/physics/vector/bearing/sea";
import {
  BreezeSchema,
  breezeParts,
} from "@repo/design-system/components/contents/physics/vector/wind/breeze";
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
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Schema } from "effect";
import type p5 from "p5";
import { type ReactNode, useState } from "react";

/** What the sketch reads on every frame: the wind. */
const BreezeFrameSchema = Schema.Struct({ breeze: BreezeSchema });
type BreezeFrame = typeof BreezeFrameSchema.Type;

/** The strongest wind the slider reaches, in m/s. */
const MAX_SPEED = 20;

/** Streaks of wind drifting over the map. */
const STREAKS = 140;

/** Pixels a streak travels per second for each m/s of wind. */
const DRIFT = 9;

/**
 * Draws a steady wind over a sea of islands, seen from a weather satellite:
 * streaks drift with the wind, and the same wind vector stands at every
 * place on a grid, the same length and the same direction wherever it is
 * drawn.
 */
function breezeProgram(sketch: p5, read: () => BreezeFrame) {
  const backdrop = createBackdrop();
  let clock = 0;
  sketch.setup = () => {
    sketch.createCanvas(1, 1);
  };
  sketch.draw = () => {
    const { breeze } = read();
    const parts = breezeParts(breeze);
    backdrop(sketch, "sea", (layer) => paintSea(layer, undefined, []));
    if (sketch.isLooping()) {
      clock += Math.min(sketch.deltaTime / 1000, 0.1);
    }
    sketch.push();
    sketch.strokeWeight(1.6);
    for (let index = 0; index < STREAKS; index += 1) {
      const span = sketch.width + 40;
      const tall = sketch.height + 40;
      const age = (clock * 0.45 + hashUnit(index, 7)) % 1;
      const x =
        ((((hashUnit(index, 1) * span + parts.east * DRIFT * clock) % span) +
          span) %
          span) -
        20;
      const y =
        ((((hashUnit(index, 2) * tall - parts.north * DRIFT * clock) % tall) +
          tall) %
          tall) -
        20;
      const tail = 4 + breeze.speed * 1.4;
      const length = Math.max(breeze.speed, 1e-6);
      sketch.stroke(
        fade(getColor("WHITE"), 0.5 * Math.sin(age * Math.PI) ** 2)
      );
      sketch.line(
        x,
        y,
        x - (parts.east / length) * tail,
        y + (parts.north / length) * tail
      );
    }
    sketch.pop();
    const columns = 5;
    const rows = 3;
    const cell = Math.min(sketch.width / columns, sketch.height / rows);
    const scale = (cell * 0.58) / MAX_SPEED;
    for (let column = 0; column < columns; column += 1) {
      for (let row = 0; row < rows; row += 1) {
        const center = {
          x: (sketch.width / columns) * (column + 0.5),
          y: (sketch.height / rows) * (row + 0.5),
        };
        sketch.noStroke();
        sketch.fill(fade(getColor("WHITE"), 0.85));
        sketch.circle(center.x, center.y, 5);
        arrow(
          sketch,
          center,
          {
            x: center.x + parts.east * scale,
            y: center.y - parts.north * scale,
          },
          { color: PLOT_COLORS.amber, head: 10, weight: 3 }
        );
      }
    }
    vignette(sketch, 0.3);
  };
}

interface WindMapVectorLabProps {
  /** The angle the wind starts blowing toward, in degrees counterclockwise from east. */
  angle: number;
  description: ReactNode;
  labels: {
    angle: ReactNode;
    angleName: string;
    east: ReactNode;
    north: ReactNode;
    speed: ReactNode;
    speedName: string;
    viewLabel: string;
  };
  /** The wind speed it starts with, in m/s. */
  speed: number;
  title: ReactNode;
}

/**
 * A steady sea wind on a weather map. The learner sets its speed and the
 * direction it blows toward; the same arrow stands at every place on the
 * map, and the card splits it into an east and a north component whose
 * signs follow the quadrant.
 */
export function WindMapVectorLab({
  angle: startAngle,
  description,
  labels,
  speed: startSpeed,
  title,
}: WindMapVectorLabProps) {
  const quantity = useQuantity();
  const [angle, setAngle] = useState(startAngle);
  const [speed, setSpeed] = useState(startSpeed);
  const breeze = Schema.decodeSync(BreezeSchema)({ angle, speed });
  const parts = breezeParts(breeze);

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <VisualCardToolbar>
        <div className="flex w-full flex-col gap-4">
          <LabSlider
            label={labels.speed}
            max={MAX_SPEED}
            min={0}
            name={labels.speedName}
            onValueChange={setSpeed}
            readout={<InlineMath math={quantity(speed, "\\text{ m/s}", 0)} />}
            step={1}
            value={speed}
          />
          <LabSlider
            label={labels.angle}
            max={359}
            min={0}
            name={labels.angleName}
            onValueChange={setAngle}
            readout={<InlineMath math={quantity(angle, "^\\circ", 0)} />}
            step={1}
            value={angle}
          />
        </div>
      </VisualCardToolbar>
      <VisualCardBody aria-label={labels.viewLabel} render={<section />}>
        <P5Sketch
          label={labels.viewLabel}
          program={breezeProgram}
          state={{ breeze }}
        />
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.east}
            value={
              <InlineMath math={quantity(parts.east, "\\text{ m/s}", 2)} />
            }
          />
          <VisualFactTabular
            label={labels.north}
            value={
              <InlineMath math={quantity(parts.north, "\\text{ m/s}", 2)} />
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
