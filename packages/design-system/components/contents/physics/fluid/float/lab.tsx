import {
  fade,
  gradientRect,
  mix,
  vignette,
} from "@repo/design-system/components/contents/physics/canvas/paint";
import { floatIn } from "@repo/design-system/components/contents/physics/fluid/pressure";
import { paintBench } from "@repo/design-system/components/contents/physics/heat/glass";
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
import { BENCH_COLORS } from "@repo/design-system/lib/material/bench";
import { ENERGY_COLORS } from "@repo/design-system/lib/material/energy";
import { INSTRUMENT_COLORS } from "@repo/design-system/lib/material/instrument";
import { Schema } from "effect";
import type p5 from "p5";
import type { ReactNode } from "react";
import { useState } from "react";

/** The two liquids the block floats in. */
const LiquidSchema = Schema.Literals(["water", "other"]);
type Liquid = typeof LiquidSchema.Type;

/** What the sketch reads on every frame: the share of the block under the surface and the liquid it floats in. */
const FloatFrameSchema = Schema.Struct({
  liquid: LiquidSchema,
  under: Schema.Finite,
});
type FloatFrame = typeof FloatFrameSchema.Type;

/**
 * Draws one moment: a glass tank of the chosen liquid and the wooden block
 * settling to the depth where it displaces its own weight, with the
 * waterline marked across it.
 */
function floatProgram(sketch: p5, read: () => FloatFrame) {
  let depth = read().under;
  sketch.setup = () => {
    sketch.createCanvas(1, 1);
  };
  sketch.draw = () => {
    const frame = read();
    depth +=
      (frame.under - depth) *
      Math.min(Math.min(sketch.deltaTime / 1000, 0.1) * 3, 1);
    const { height, width } = sketch;
    const top = height * 0.86;
    paintBench(sketch, top);
    const tank = {
      height: height * 0.5,
      width: width * 0.62,
      x: width * 0.19,
      y: top - height * 0.5,
    };
    const surface = tank.y + tank.height * 0.35;
    const liquid =
      frame.liquid === "water"
        ? ENERGY_COLORS.kettleWater
        : ENERGY_COLORS.dieselFuel;
    gradientRect(
      sketch,
      {
        height: tank.y + tank.height - surface,
        width: tank.width,
        x: tank.x,
        y: surface,
      },
      [
        [0, fade(liquid, 0.7)],
        [1, fade(mix(liquid, getColor("BLACK"), 0.35), 0.85)],
      ]
    );
    const side = tank.height * 0.42;
    const blockTop = surface - side * (1 - depth);
    gradientRect(
      sketch,
      { height: side, width: side, x: width / 2 - side / 2, y: blockTop },
      [
        [0, mix(INSTRUMENT_COLORS.pine, getColor("WHITE"), 0.15)],
        [1, mix(INSTRUMENT_COLORS.pine, getColor("BLACK"), 0.25)],
      ],
      true
    );
    sketch.noStroke();
    sketch.fill(fade(liquid, 0.4));
    sketch.rect(width / 2 - side / 2, surface, side, blockTop + side - surface);
    sketch.stroke(fade(getColor("WHITE"), 0.85));
    sketch.strokeWeight(2);
    sketch.line(tank.x, surface, tank.x + tank.width, surface);
    sketch.noFill();
    sketch.stroke(fade(BENCH_COLORS.glass, 0.75));
    sketch.strokeWeight(3);
    sketch.line(tank.x, tank.y, tank.x, tank.y + tank.height);
    sketch.line(
      tank.x + tank.width,
      tank.y,
      tank.x + tank.width,
      tank.y + tank.height
    );
    sketch.line(
      tank.x,
      tank.y + tank.height,
      tank.x + tank.width,
      tank.y + tank.height
    );
    vignette(sketch, 0.3);
  };
}

interface FloatingBlockLabProps {
  /** The density of the second liquid, in g cm⁻³, with water at 1.0. */
  density: number;
  description: NonNullable<ReactNode>;
  labels: {
    above: ReactNode;
    liquid: string;
    liquids: Record<Liquid, ReactNode>;
    under: ReactNode;
    viewLabel: string;
  };
  title: NonNullable<ReactNode>;
  /** The volume of the block below the water surface, in cm³. */
  underWater: number;
  /** The volume of the block, in cm³. */
  volume: number;
}

/**
 * A wooden block floats in a tank of water, then in a lighter liquid. Its
 * mass never changes, so it always displaces that same mass of liquid: in
 * the lighter liquid that takes a larger volume, and the block sits deeper.
 */
export function FloatingBlockLab({
  density,
  description,
  labels,
  title,
  underWater,
  volume,
}: FloatingBlockLabProps) {
  const quantity = useQuantity();
  const [liquid, setLiquid] = useState<Liquid>("water");
  const isLiquid = Schema.is(LiquidSchema);
  const floating = floatIn(
    volume,
    underWater,
    liquid === "water" ? 1 : density
  );

  return (
    <VisualCard
      onReset={() => {
        setLiquid("water");
      }}
    >
      <VisualCardHeader description={description} title={title} />
      <VisualCardToolbar>
        <ToggleGroup
          aria-label={labels.liquid}
          onValueChange={(value) => {
            if (isLiquid(value)) {
              setLiquid(value);
            }
          }}
          type="single"
          value={liquid}
          variant="outline"
        >
          <ToggleGroupItem value="water">
            {labels.liquids.water}
          </ToggleGroupItem>
          <ToggleGroupItem value="other">
            {labels.liquids.other}
          </ToggleGroupItem>
        </ToggleGroup>
      </VisualCardToolbar>
      <VisualCardBody aria-label={labels.viewLabel} render={<section />}>
        <P5Sketch
          label={labels.viewLabel}
          program={floatProgram}
          state={{ liquid, under: floating.under / volume }}
        />
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.under}
            value={
              <InlineMath math={quantity(floating.under, "\\text{ cm}^3", 0)} />
            }
          />
          <VisualFactTabular
            label={labels.above}
            value={
              <InlineMath math={quantity(floating.above, "\\text{ cm}^3", 0)} />
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
