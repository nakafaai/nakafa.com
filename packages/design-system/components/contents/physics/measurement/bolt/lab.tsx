import {
  arrow,
  fade,
  gradientRect,
  litBall,
  mix,
  spotlight,
  vignette,
  withShadow,
} from "@repo/design-system/components/contents/physics/canvas/paint";
import {
  BoltQuantitySchema,
  boltQuantities,
  SHANK_DIAMETER,
  SHANK_LENGTH,
} from "@repo/design-system/components/contents/physics/measurement/bolt/quantities";
import { useFixed } from "@repo/design-system/components/contents/physics/measurement/digits";
import { scientific } from "@repo/design-system/components/contents/physics/measurement/figures";
import { steelStops } from "@repo/design-system/components/contents/physics/measurement/scale";
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

/** The head's height across its corners, in millimetres, for an M10 hex head. */
const HEAD_HEIGHT = 18.5;

/** The head's thickness, in millimetres. */
const HEAD_THICK = 6.4;

/** How much of the shank carries thread, from the tip. */
const THREAD_SHARE = 0.55;

/** The units of each quantity, as KaTeX. */
const UNITS = {
  area: "\\text{ m}^2",
  density: "\\text{ kg/m}^3",
  diameter: "\\text{ m}",
  length: "\\text{ m}",
  mass: "\\text{ kg}",
  volume: "\\text{ m}^3",
} as const satisfies Record<typeof BoltQuantitySchema.Type, string>;

/** What the sketch reads on every frame: the quantity in view. */
const BoltFrame = Schema.Struct({ quantity: BoltQuantitySchema });

/** Positions of the bolt for one canvas size. */
function layout(sketch: p5) {
  const { height, width } = sketch;
  const millimetre = Math.min(
    (width * 0.62) / (SHANK_LENGTH + HEAD_THICK),
    (height * 0.5) / HEAD_HEIGHT
  );
  const left = (width - (SHANK_LENGTH + HEAD_THICK) * millimetre) / 2;
  return {
    axis: height * 0.42,
    head: left + HEAD_THICK * millimetre,
    left,
    millimetre,
  };
}

/** The bench under a lamp. */
function paintBench(sketch: p5) {
  const { height, width } = sketch;
  gradientRect(sketch, { height, width, x: 0, y: 0 }, [
    [0, mix(getColor("SLATE", 600), getColor("WHITE"), 0.12)],
    [1, mix(getColor("SLATE", 800), getColor("BLACK"), 0.4)],
  ]);
  spotlight(sketch, { x: width * 0.4, y: height * 0.25 }, width * 0.6, {
    color: mix(getColor("SLATE", 200), getColor("WHITE"), 0.6),
    strength: 0.3,
  });
}

/** The weighing pan the bolt rests on when its mass is read, with the dial at `grams`. */
function paintPan(sketch: p5, place: ReturnType<typeof layout>, grams: number) {
  const { height, width } = sketch;
  const pan =
    place.axis + (SHANK_DIAMETER / 2) * place.millimetre + height * 0.06;
  withShadow(
    sketch,
    { blur: 18, color: fade(getColor("BLACK"), 0.55), drop: 8 },
    () => {
      gradientRect(
        sketch,
        { height: height * 0.025, width: width * 0.8, x: width * 0.1, y: pan },
        steelStops(0.05)
      );
      gradientRect(
        sketch,
        {
          height: height * 0.2,
          width: width * 0.5,
          x: width * 0.25,
          y: pan + height * 0.025,
        },
        [
          [0, getColor("SLATE", 300)],
          [1, getColor("SLATE", 700)],
        ]
      );
    }
  );
  const dial = { x: width * 0.5, y: pan + height * 0.125 };
  const radius = height * 0.075;
  litBall(sketch, dial, radius, {
    dark: getColor("SLATE", 300),
    light: getColor("WHITE"),
  });
  sketch.stroke(getColor("ZINC", 900));
  sketch.strokeWeight(1);
  Arr.forEach(Arr.range(0, 20), (mark) => {
    const angle =
      -Math.PI / 2 - (Math.PI * 5) / 6 + (mark / 20) * ((Math.PI * 5) / 3);
    sketch.line(
      dial.x + radius * 0.72 * Math.cos(angle),
      dial.y + radius * 0.72 * Math.sin(angle),
      dial.x + radius * 0.88 * Math.cos(angle),
      dial.y + radius * 0.88 * Math.sin(angle)
    );
  });
  const needle =
    -Math.PI / 2 - (Math.PI * 5) / 6 + (grams / 100) * ((Math.PI * 5) / 3);
  sketch.stroke(MATERIAL.dialNeedle);
  sketch.strokeWeight(2.5);
  sketch.line(
    dial.x,
    dial.y,
    dial.x + radius * 0.85 * Math.cos(needle),
    dial.y + radius * 0.85 * Math.sin(needle)
  );
  sketch.noStroke();
}

/** The bolt lying on its side: hex head, plain shank, rolled thread and chamfered tip. */
function paintBolt(sketch: p5, place: ReturnType<typeof layout>) {
  const shank = (SHANK_DIAMETER / 2) * place.millimetre;
  const head = (HEAD_HEIGHT / 2) * place.millimetre;
  const tip = place.head + SHANK_LENGTH * place.millimetre;
  withShadow(
    sketch,
    { blur: 22, color: fade(getColor("BLACK"), 0.6), drop: 10 },
    () => {
      gradientRect(
        sketch,
        {
          height: shank * 2,
          width: tip - place.head - shank * 0.3,
          x: place.head,
          y: place.axis - shank,
        },
        steelStops(0.15)
      );
      sketch.fill(getColor("SLATE", 400));
      sketch.quad(
        tip - shank * 0.3,
        place.axis - shank,
        tip,
        place.axis - shank * 0.7,
        tip,
        place.axis + shank * 0.7,
        tip - shank * 0.3,
        place.axis + shank
      );
      gradientRect(
        sketch,
        {
          height: head * 2,
          width: place.head - place.left,
          x: place.left,
          y: place.axis - head,
        },
        steelStops(0.25)
      );
    }
  );
  sketch.fill(fade(getColor("WHITE"), 0.25));
  sketch.rect(
    place.left,
    place.axis - head * 0.5,
    place.head - place.left,
    head
  );
  sketch.stroke(fade(getColor("ZINC", 900), 0.45));
  sketch.strokeWeight(1);
  sketch.line(
    place.left,
    place.axis - head * 0.5,
    place.head,
    place.axis - head * 0.5
  );
  sketch.line(
    place.left,
    place.axis + head * 0.5,
    place.head,
    place.axis + head * 0.5
  );
  const pitch = 1.5 * place.millimetre;
  const threadStart = tip - SHANK_LENGTH * THREAD_SHARE * place.millimetre;
  sketch.strokeWeight(Math.max(place.millimetre * 0.25, 1));
  for (let x = threadStart; x < tip - shank * 0.3; x += pitch) {
    sketch.stroke(fade(getColor("ZINC", 900), 0.5));
    sketch.line(x, place.axis - shank, x + pitch * 0.6, place.axis + shank);
    sketch.stroke(fade(getColor("WHITE"), 0.35));
    sketch.line(
      x + pitch * 0.25,
      place.axis - shank,
      x + pitch * 0.85,
      place.axis + shank
    );
  }
  sketch.noStroke();
}

/** The highlight for the quantity in view: an arrow for a length, the cut face for the area, a glow for the volume. */
function paintQuantity(
  sketch: p5,
  place: ReturnType<typeof layout>,
  quantity: typeof BoltQuantitySchema.Type
) {
  const shank = (SHANK_DIAMETER / 2) * place.millimetre;
  const tip = place.head + SHANK_LENGTH * place.millimetre;
  const ink = { color: PLOT_COLORS.orange, head: 10, weight: 3 };
  if (quantity === "length") {
    const y = place.axis - shank - sketch.height * 0.08;
    arrow(sketch, { x: (place.head + tip) / 2, y }, { x: place.head, y }, ink);
    arrow(sketch, { x: (place.head + tip) / 2, y }, { x: tip, y }, ink);
  }
  if (quantity === "diameter") {
    const x = place.head + SHANK_LENGTH * 0.25 * place.millimetre;
    const teal = { ...ink, color: PLOT_COLORS.teal };
    arrow(sketch, { x, y: place.axis }, { x, y: place.axis - shank }, teal);
    arrow(sketch, { x, y: place.axis }, { x, y: place.axis + shank }, teal);
  }
  if (quantity === "area") {
    sketch.fill(fade(PLOT_COLORS.fuchsia, 0.7));
    sketch.ellipse(
      tip + sketch.width * 0.05,
      place.axis,
      shank * 0.8,
      shank * 2
    );
    sketch.stroke(fade(PLOT_COLORS.fuchsia, 0.8));
    sketch.strokeWeight(1.5);
    sketch.line(
      tip,
      place.axis - shank * 0.7,
      tip + sketch.width * 0.05,
      place.axis - shank
    );
    sketch.line(
      tip,
      place.axis + shank * 0.7,
      tip + sketch.width * 0.05,
      place.axis + shank
    );
    sketch.noStroke();
  }
  if (quantity === "volume" || quantity === "density") {
    sketch.fill(fade(PLOT_COLORS.violet, 0.4));
    sketch.rect(place.head, place.axis - shank, tip - place.head, shank * 2);
  }
}

/** Draws the bolt with the quantity in view marked on it. */
function boltProgram(sketch: p5, read: () => typeof BoltFrame.Type) {
  sketch.setup = () => {
    sketch.createCanvas(1, 1);
    sketch.noStroke();
  };
  sketch.draw = () => {
    const { quantity } = read();
    const place = layout(sketch);
    paintBench(sketch);
    if (quantity === "mass" || quantity === "density") {
      paintPan(sketch, place, boltQuantities().mass.value * 1000);
    }
    paintBolt(sketch, place);
    paintQuantity(sketch, place, quantity);
    vignette(sketch, 0.35);
  };
}

/** A dimension as KaTeX from its powers of mass and length: [M], [L]^2, [M][L]^{-3}. */
function dimensionOf(mass: number, length: number) {
  const part = (symbol: string, power: number) => {
    if (power === 0) {
      return "";
    }
    return power === 1
      ? `[\\mathrm{${symbol}}]`
      : `[\\mathrm{${symbol}}]^{${power}}`;
  };
  return `${part("M", mass)}${part("L", length)}`;
}

interface BoltDimensionsLabProps {
  description: ReactNode;
  labels: {
    chooseQuantity: string;
    dimension: ReactNode;
    quantities: Record<typeof BoltQuantitySchema.Type, ReactNode>;
    value: ReactNode;
    viewLabel: string;
  };
  title: ReactNode;
}

/**
 * One M10 bolt and six quantities: its length and diameter, its shank's
 * cross-section and volume, its mass, and the density of its steel. Each
 * quantity marks its part of the bolt and shows its value and dimension.
 */
export function BoltDimensionsLab({
  description,
  labels,
  title,
}: BoltDimensionsLabProps) {
  const [quantity, setQuantity] =
    useState<typeof BoltQuantitySchema.Type>("length");
  const fixed = useFixed();
  const shown = boltQuantities()[quantity];
  const value = scientific(shown.value, 3);
  const isQuantity = Schema.is(BoltQuantitySchema);

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <VisualCardToolbar>
        <ToggleGroup
          aria-label={labels.chooseQuantity}
          gridColumns="3"
          onValueChange={(next) => {
            if (isQuantity(next)) {
              setQuantity(next);
            }
          }}
          type="single"
          value={quantity}
          variant="outline"
        >
          {Arr.map(BoltQuantitySchema.literals, (option) => (
            <ToggleGroupItem key={option} value={option}>
              {labels.quantities[option]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </VisualCardToolbar>
      <VisualCardBody aria-label={labels.viewLabel} render={<section />}>
        <P5Sketch
          label={labels.viewLabel}
          program={boltProgram}
          state={{ quantity }}
        />
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.value}
            value={
              <InlineMath
                math={`${fixed(value.coefficient, "", 2)}\\times10^{${value.exponent}}${UNITS[quantity]}`}
              />
            }
          />
          <VisualFactTabular
            label={labels.dimension}
            value={<InlineMath math={dimensionOf(shown.mass, shown.length)} />}
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
