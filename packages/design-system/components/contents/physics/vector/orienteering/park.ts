import {
  fade,
  gradientRect,
  mix,
  type PointSchema,
  withShadow,
} from "@repo/design-system/components/contents/physics/canvas/paint";
import { hashUnit } from "@repo/design-system/components/contents/simulation/grain";
import { getColor } from "@repo/design-system/lib/color";
import { MATERIAL } from "@repo/design-system/lib/material";
import { Array as Arr } from "effect";
import type p5 from "p5";

/** A point on the canvas, in pixels. */
type Spot = typeof PointSchema.Type;

/** A tree crown from above, lit from the north-west, with its shadow to the south-east. */
function paintTree(layer: p5, at: Spot, radius: number) {
  layer.noStroke();
  layer.fill(fade(getColor("BLACK"), 0.28));
  layer.circle(at.x + radius * 0.45, at.y + radius * 0.45, radius * 2.1);
  layer.fill(MATERIAL.foliageDark);
  layer.circle(at.x, at.y, radius * 2);
  layer.fill(MATERIAL.foliage);
  layer.circle(at.x - radius * 0.2, at.y - radius * 0.2, radius * 1.45);
  layer.fill(MATERIAL.foliageLight);
  layer.circle(at.x - radius * 0.38, at.y - radius * 0.38, radius * 0.7);
}

/**
 * Paints a city park seen from a drone, the ground of the orienteering
 * map: mown grass in broad stripes, a gravel loop path, a pond, and
 * clusters of trees that keep clear of the checkpoints.
 */
export function paintPark(layer: p5, keep: readonly Spot[]) {
  const { height, width } = layer;
  gradientRect(layer, { height, width, x: 0, y: 0 }, [
    [0, mix(MATERIAL.grass, MATERIAL.foliageLight, 0.4)],
    [1, mix(MATERIAL.grass, MATERIAL.foliageDark, 0.3)],
  ]);
  layer.noStroke();
  for (let stripe = 0; stripe < width; stripe += 46) {
    layer.fill(fade(getColor("WHITE"), (stripe / 46) % 2 === 0 ? 0.035 : 0));
    layer.rect(stripe, 0, 23, height);
  }
  layer.noFill();
  layer.stroke(fade(MATERIAL.gravelGroove, 0.5));
  layer.strokeWeight(13);
  layer.ellipse(width * 0.5, height * 0.52, width * 0.82, height * 0.74);
  layer.stroke(MATERIAL.gravel);
  layer.strokeWeight(10);
  layer.ellipse(width * 0.5, height * 0.52, width * 0.82, height * 0.74);
  layer.line(width * 0.09, height * 0.52, width * 0.91, height * 0.52);
  layer.noStroke();
  const pond = { x: width * 0.72, y: height * 0.26 };
  layer.fill(MATERIAL.riverbank);
  layer.ellipse(pond.x, pond.y, width * 0.2, height * 0.17);
  withShadow(
    layer,
    { blur: 10, color: fade(getColor("BLACK"), 0.4), drop: 2 },
    () => {
      layer.fill(MATERIAL.water);
      layer.ellipse(pond.x, pond.y, width * 0.18, height * 0.15);
    }
  );
  layer.fill(fade(MATERIAL.waterGlint, 0.25));
  layer.ellipse(
    pond.x - width * 0.03,
    pond.y - height * 0.03,
    width * 0.06,
    height * 0.03
  );
  const reach = Math.min(width, height);
  for (let tree = 0; tree < 46; tree += 1) {
    const at = {
      x: hashUnit(tree, 21) * width,
      y: hashUnit(tree, 22) * height,
    };
    const radius = reach * (0.018 + hashUnit(tree, 23) * 0.016);
    const clear =
      Math.hypot(at.x - pond.x, at.y - pond.y) > reach * 0.14 &&
      Arr.every(
        keep,
        (spot) => Math.hypot(at.x - spot.x, at.y - spot.y) > reach * 0.09
      );
    if (clear) {
      paintTree(layer, at, radius);
    }
  }
}

/** A checkpoint flag seen from above: an orange and white prism with its shadow. */
export function paintFlag(sketch: p5, at: Spot, size: number) {
  sketch.noStroke();
  sketch.fill(fade(getColor("BLACK"), 0.35));
  sketch.rect(at.x - size * 0.3, at.y - size * 0.3, size, size * 0.8, 2);
  sketch.fill(MATERIAL.deckWhite);
  sketch.rect(at.x - size * 0.5, at.y - size * 0.5, size, size, 2);
  sketch.fill(MATERIAL.kiteNylon);
  sketch.triangle(
    at.x + size * 0.5,
    at.y - size * 0.5,
    at.x + size * 0.5,
    at.y + size * 0.5,
    at.x - size * 0.5,
    at.y + size * 0.5
  );
}
