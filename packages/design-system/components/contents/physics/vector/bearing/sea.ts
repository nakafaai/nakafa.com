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

/** The distance from a point to a segment, in pixels. */
function segmentGap(point: Spot, from: Spot, to: Spot) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = dx * dx + dy * dy;
  const part =
    length === 0
      ? 0
      : Math.min(
          Math.max(((point.x - from.x) * dx + (point.y - from.y) * dy) / length, 0),
          1
        );
  return Math.hypot(point.x - from.x - dx * part, point.y - from.y - dy * part);
}

/** One island: a beach ring, then woods, as a rounded blob whose outline comes from a hash. */
function paintIsland(layer: p5, center: Spot, radius: number, seed: number) {
  const outline = (scale: number) => {
    layer.beginShape();
    for (let step = 0; step < 48; step += 1) {
      const turn = (step / 48) * Math.PI * 2;
      const wobble =
        0.86 +
        0.16 * Math.sin(2 * turn + hashUnit(seed, 1) * 6.3) +
        0.09 * Math.sin(3 * turn + hashUnit(seed, 2) * 6.3) +
        0.04 * Math.sin(5 * turn + hashUnit(seed, 3) * 6.3);
      layer.vertex(
        center.x + Math.cos(turn) * radius * wobble * scale,
        center.y + Math.sin(turn) * radius * wobble * scale * 0.8
      );
    }
    layer.endShape(layer.CLOSE);
  };
  layer.noStroke();
  layer.fill(fade(mix(MATERIAL.water, MATERIAL.waterGlint, 0.45), 0.8));
  outline(1.35);
  layer.fill(MATERIAL.sand);
  outline(1.05);
  withShadow(layer, { blur: 6, color: fade(getColor("BLACK"), 0.35), drop: 3 }, () => {
    layer.fill(MATERIAL.foliageShade);
    outline(0.88);
  });
  layer.fill(MATERIAL.foliageLight);
  for (let tree = 0; tree < 9; tree += 1) {
    layer.circle(
      center.x + (hashUnit(seed + tree, 3) - 0.5) * radius * 0.9,
      center.y + (hashUnit(seed, tree + 5) - 0.5) * radius * 0.7,
      radius * (0.12 + hashUnit(tree, seed) * 0.1)
    );
  }
}

/**
 * Paints the open sea seen from far above: deep water darker toward the
 * edges, swell lines, islands that keep clear of the route, and the harbour
 * quay the voyage leaves from.
 */
export function paintSea(layer: p5, harbour: Spot, route: readonly Spot[]) {
  gradientRect(
    layer,
    { height: layer.height, width: layer.width, x: 0, y: 0 },
    [
      [0, MATERIAL.waterDeep],
      [0.5, MATERIAL.water],
      [1, MATERIAL.waterDeep],
    ],
    true
  );
  layer.stroke(fade(MATERIAL.waterGlint, 0.08));
  layer.strokeWeight(1);
  for (let swell = 0; swell < 70; swell += 1) {
    const x = hashUnit(swell, 1) * layer.width;
    const y = hashUnit(swell, 2) * layer.height;
    layer.line(x, y, x + 18 + hashUnit(swell, 3) * 26, y - 4);
  }
  layer.noStroke();
  const scale = Math.min(layer.width, layer.height);
  for (let island = 0; island < 9; island += 1) {
    const center = {
      x: hashUnit(island, 11) * layer.width,
      y: hashUnit(island, 12) * layer.height,
    };
    const radius = scale * (0.05 + hashUnit(island, 13) * 0.05);
    const near = Arr.some(
      route,
      (point, index) =>
        index > 0 &&
        segmentGap(center, route[index - 1] ?? point, point) < radius * 1.6
    );
    if (!near && Math.hypot(center.x - harbour.x, center.y - harbour.y) > radius * 2) {
      paintIsland(layer, center, radius, island * 17);
    }
  }
  withShadow(layer, { blur: 5, color: fade(getColor("BLACK"), 0.4), drop: 2 }, () => {
    layer.fill(MATERIAL.concrete);
    layer.rect(harbour.x - 34, harbour.y + 6, 68, 10);
    layer.rect(harbour.x - 5, harbour.y + 6, 10, 26);
  });
}

/** A ferry seen from above, bow up the canvas before it turns to its bearing, with its wake behind. */
export function paintFerry(sketch: p5, size: number) {
  sketch.noStroke();
  sketch.fill(fade(MATERIAL.waterGlint, 0.5));
  sketch.triangle(0, size * 0.4, -size * 0.45, size * 1.6, size * 0.45, size * 1.6);
  sketch.fill(fade(MATERIAL.waterDeep, 1));
  sketch.triangle(0, size * 0.6, -size * 0.3, size * 1.6, size * 0.3, size * 1.6);
  sketch.fill(MATERIAL.hullNavy);
  sketch.beginShape();
  sketch.vertex(0, -size * 0.55);
  sketch.vertex(size * 0.17, -size * 0.25);
  sketch.vertex(size * 0.17, size * 0.45);
  sketch.vertex(-size * 0.17, size * 0.45);
  sketch.vertex(-size * 0.17, -size * 0.25);
  sketch.endShape(sketch.CLOSE);
  sketch.fill(MATERIAL.deckWhite);
  sketch.rect(-size * 0.13, -size * 0.2, size * 0.26, size * 0.58, 2);
  sketch.fill(MATERIAL.hullRed);
  sketch.rect(-size * 0.05, size * 0.1, size * 0.1, size * 0.1, 2);
  sketch.fill(MATERIAL.tintedGlass);
  sketch.rect(-size * 0.11, -size * 0.16, size * 0.22, size * 0.06, 1);
}
