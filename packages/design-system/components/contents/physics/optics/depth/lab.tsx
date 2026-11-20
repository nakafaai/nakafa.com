import {
  dashed,
  fade,
  gradientRect,
  mix,
  vignette,
} from "@repo/design-system/components/contents/physics/canvas/paint";
import type { Point } from "@repo/design-system/components/contents/physics/optics/light";
import {
  beam,
  paintBenchTop,
  paintDarkRoom,
} from "@repo/design-system/components/contents/physics/optics/light";
import {
  apparentDepth,
  traceLayers,
} from "@repo/design-system/components/contents/physics/optics/ray";
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
import { REAGENT_COLORS } from "@repo/design-system/lib/material/reagent";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Array as Arr, Schema } from "effect";
import type p5 from "p5";
import type { ReactNode } from "react";
import { useState } from "react";

/** The liquids the container can hold, each drawn in its own colour. */
const LiquidSchema = Schema.Literals(["water", "oil", "glycerine", "alcohol"]);
type Liquid = typeof LiquidSchema.Type;

/** How each liquid looks through the glass. */
const LIQUID_COLORS = {
  alcohol: BENCH_COLORS.glass,
  glycerine: REAGENT_COLORS.solution,
  oil: ENERGY_COLORS.dieselFuel,
  water: ENERGY_COLORS.kettleWater,
} as const satisfies Record<Liquid, string>;

/** One poured layer: what it is, how thick it is in centimetres, and its refractive index. */
const PouredLayerSchema = Schema.Struct({
  index: Schema.Finite,
  liquid: LiquidSchema,
  thickness: Schema.Finite,
});
type PouredLayer = typeof PouredLayerSchema.Type;

/** The angle from the vertical, in degrees, of the two rays drawn from the coin in the bottom layer. */
const RAY_ANGLE = 7;

/** What the sketch reads on every frame: the poured layers from the top down, and the deepest the container gets. */
const DepthFrameSchema = Schema.Struct({
  capacity: Schema.Finite,
  layers: Schema.NonEmptyArray(PouredLayerSchema),
});
type DepthFrame = typeof DepthFrameSchema.Type;

/** The container's place on a canvas of this size and its scale in pixels per centimetre. */
function layout(sketch: p5, capacity: number) {
  const bottom = sketch.height * 0.86;
  const scale = (sketch.height * 0.58) / capacity;
  const half = Math.min(sketch.width * 0.2, scale * 6);
  return { bottom, centre: sketch.width * 0.46, half, scale };
}

/** The glass container, the layers poured in it, and the coin on its floor. */
function paintContainer(
  sketch: p5,
  frame: DepthFrame,
  place: ReturnType<typeof layout>
) {
  const { bottom, centre, half, scale } = place;
  let floor = bottom;
  for (const layer of Arr.reverse(frame.layers)) {
    const tall = layer.thickness * scale;
    const color = LIQUID_COLORS[layer.liquid];
    gradientRect(
      sketch,
      { height: tall, width: half * 2, x: centre - half, y: floor - tall },
      [
        [0, fade(color, 0.55)],
        [1, fade(mix(color, getColor("BLACK"), 0.25), 0.7)],
      ],
      true
    );
    sketch.stroke(fade(mix(color, getColor("WHITE"), 0.5), 0.8));
    sketch.strokeWeight(1.5);
    sketch.line(centre - half, floor - tall, centre + half, floor - tall);
    floor -= tall;
  }
  sketch.noFill();
  sketch.stroke(fade(BENCH_COLORS.glass, 0.75));
  sketch.strokeWeight(3);
  sketch.line(
    centre - half,
    bottom - frame.capacity * scale * 1.08,
    centre - half,
    bottom
  );
  sketch.line(
    centre + half,
    bottom - frame.capacity * scale * 1.08,
    centre + half,
    bottom
  );
  sketch.line(centre - half, bottom, centre + half, bottom);
  sketch.noStroke();
  sketch.fill(mix(INSTRUMENT_COLORS.brass, getColor("BLACK"), 0.45));
  sketch.ellipse(centre, bottom - 3, half * 0.5, 9);
  sketch.fill(mix(INSTRUMENT_COLORS.brass, getColor("WHITE"), 0.25));
  sketch.ellipse(centre, bottom - 5, half * 0.46, 7);
}

/** An eye above the container, looking straight down. */
function paintEye(sketch: p5, at: Point, size: number) {
  sketch.noStroke();
  sketch.fill(BENCH_COLORS.dish);
  sketch.ellipse(at.x, at.y, size * 2, size);
  sketch.fill(INSTRUMENT_COLORS.iris);
  sketch.circle(at.x, at.y + size * 0.12, size * 0.62);
  sketch.fill(getColor("BLACK"));
  sketch.circle(at.x, at.y + size * 0.16, size * 0.3);
  sketch.stroke(getColor("NEUTRAL", 700));
  sketch.strokeWeight(2);
  sketch.noFill();
  sketch.arc(at.x, at.y, size * 2, size * 1.2, Math.PI, Math.PI * 2);
}

/** A bracket beside the container from `from` to `to` pixels down the canvas, in `color`. */
function bracket(
  sketch: p5,
  x: number,
  from: number,
  to: number,
  color: string
) {
  sketch.stroke(color);
  sketch.strokeWeight(2);
  sketch.line(x, from, x, to);
  sketch.line(x - 6, from, x + 6, from);
  sketch.line(x - 6, to, x + 6, to);
}

/**
 * Draws the poured layers with a coin on the floor, two rays from the coin
 * that bend away from the normal at every boundary on their way up to the
 * eye, their dashed extensions back down to where they seem to come from,
 * and the faint image of the coin there, with brackets for the real and the
 * apparent depth.
 */
function depthProgram(sketch: p5, read: () => DepthFrame) {
  sketch.setup = () => {
    sketch.createCanvas(1, 1);
  };
  sketch.draw = () => {
    const frame = read();
    const place = layout(sketch, frame.capacity);
    const { bottom, centre, half, scale } = place;
    paintDarkRoom(sketch);
    paintBenchTop(sketch, bottom);
    paintContainer(sketch, frame, place);
    const depth = apparentDepth(frame.layers);
    const surface = bottom - depth.real * scale;
    const eye = {
      x: centre,
      y: Math.max(sketch.height * 0.08, surface - scale * 6),
    };
    const { crossings, emerges } = traceLayers(frame.layers, RAY_ANGLE);
    const lean = Math.tan((emerges * Math.PI) / 180);
    for (const side of [-1, 1]) {
      const points = Arr.map(crossings, (spot) => ({
        x: centre + side * spot.x * scale,
        y: bottom - spot.y * scale,
      }));
      const top = Arr.lastNonEmpty(points);
      const rise = top.y - eye.y;
      const out = { x: top.x + side * lean * rise, y: eye.y + 10 };
      for (const [from, to] of Arr.zip(points, Arr.drop(points, 1))) {
        beam(sketch, from, to, INSTRUMENT_COLORS.lampLight, 0.9);
      }
      beam(sketch, top, out, INSTRUMENT_COLORS.lampLight, 0.9);
      const imageY = bottom - depth.image * scale;
      const back = { x: top.x - side * lean * (imageY - top.y), y: imageY };
      dashed(sketch, top, back, {
        color: fade(INSTRUMENT_COLORS.lampLight, 0.7),
        dash: 5,
        weight: 1.5,
      });
    }
    const image = bottom - depth.image * scale;
    sketch.noStroke();
    sketch.fill(fade(INSTRUMENT_COLORS.brass, 0.35));
    sketch.ellipse(centre, image, half * 0.5, 8);
    sketch.stroke(fade(PLOT_COLORS.amber, 0.9));
    sketch.strokeWeight(1.5);
    sketch.noFill();
    sketch.ellipse(centre, image, half * 0.56, 11);
    paintEye(sketch, eye, Math.min(18, scale * 1.4));
    const right = centre + half + 18;
    bracket(sketch, right, surface, bottom, PLOT_COLORS.teal);
    bracket(sketch, right + 18, surface, image, PLOT_COLORS.amber);
    vignette(sketch, 0.3);
  };
}

interface ApparentDepthLabProps {
  description: NonNullable<ReactNode>;
  labels: {
    apparent: ReactNode;
    image: ReactNode;
    liquids: Record<Liquid, ReactNode>;
    real: ReactNode;
    top: string;
    viewLabel: string;
  };
  /** The liquids in the container, from the top layer down. */
  layers: Arr.NonEmptyReadonlyArray<PouredLayer>;
  title: NonNullable<ReactNode>;
}

/**
 * A coin on the floor of a glass container holding one or more liquids in
 * layers, seen straight down by an eye above. Each layer looks shallower
 * than it is, its thickness over its refractive index, so the coin's image
 * floats above the floor. Pour or remove the top layers and read where the
 * image moves, measured up from the floor where the coin stays.
 */
export function ApparentDepthLab({
  description,
  labels,
  layers,
  title,
}: ApparentDepthLabProps) {
  const quantity = useQuantity();
  const [top, setTop] = useState(0);
  const remaining = Arr.drop(layers, top);
  const shown = Arr.isReadonlyArrayNonEmpty(remaining) ? remaining : layers;
  const capacity = Arr.reduce(layers, 0, (sum, layer) => sum + layer.thickness);
  const depth = apparentDepth(shown);

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <VisualCardToolbar>
        <ToggleGroup
          aria-label={labels.top}
          onValueChange={(value) => setTop(Number(value))}
          type="single"
          value={String(top)}
          variant="outline"
        >
          {Arr.map(
            Arr.map(layers, (layer, index) => ({
              liquid: layer.liquid,
              value: String(index),
            })),
            (item) => (
              <ToggleGroupItem key={item.value} value={item.value}>
                {labels.liquids[item.liquid]}
              </ToggleGroupItem>
            )
          )}
        </ToggleGroup>
      </VisualCardToolbar>
      <VisualCardBody aria-label={labels.viewLabel} render={<section />}>
        <P5Sketch
          label={labels.viewLabel}
          program={depthProgram}
          state={{ capacity, layers: shown }}
        />
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.real}
            value={<InlineMath math={quantity(depth.real, "\\text{ cm}", 1)} />}
          />
          <VisualFactTabular
            label={labels.apparent}
            value={
              <InlineMath math={quantity(depth.apparent, "\\text{ cm}", 1)} />
            }
          />
          <VisualFactTabular
            label={labels.image}
            value={
              <InlineMath math={quantity(depth.image, "\\text{ cm}", 1)} />
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
