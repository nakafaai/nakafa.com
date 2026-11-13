import {
  fade,
  gradientRect,
  mix,
  withShadow,
} from "@repo/design-system/components/contents/physics/canvas/paint";
import { hashUnit } from "@repo/design-system/components/contents/simulation/grain";
import { getColor } from "@repo/design-system/lib/color";
import { MATERIAL } from "@repo/design-system/lib/material";
import { Schema } from "effect";
import type p5 from "p5";

/**
 * A town seen straight down from a drone, the stage of the map sketches:
 * streets on a square grid, blocks of houses with terracotta and zinc roofs
 * that cast soft shadows to the south-east, and trees in the yards. Every
 * block looks the same on every visit, because its look comes from a hash
 * of its place, not from chance.
 */

/** How metres east and north map onto the canvas: the canvas point of the origin and pixels per metre. */
const PlanSchema = Schema.Struct({
  originX: Schema.Finite,
  originY: Schema.Finite,
  scale: Schema.Finite,
});
export type Plan = typeof PlanSchema.Type;

/** The canvas point of a place east and north of the origin, north up. */
export function planPoint(
  plan: Plan,
  place: { readonly east: number; readonly north: number }
) {
  return {
    x: plan.originX + place.east * plan.scale,
    y: plan.originY - place.north * plan.scale,
  };
}

/**
 * Fits a box of places, in metres, into the canvas with a margin, keeping
 * north up and metres square.
 */
export function fitPlan(
  sketch: p5,
  box: {
    readonly east: readonly [number, number];
    readonly north: readonly [number, number];
  },
  margin: number
) {
  const wide = Math.max(box.east[1] - box.east[0], 1);
  const tall = Math.max(box.north[1] - box.north[0], 1);
  const scale = Math.min(
    (sketch.width - 2 * margin) / wide,
    (sketch.height - 2 * margin) / tall
  );
  return {
    originX: (sketch.width - wide * scale) / 2 - box.east[0] * scale,
    originY: (sketch.height + tall * scale) / 2 + box.north[0] * scale,
    scale,
  };
}

/** One house on its lot: a roof lit from the north-west with its shadow to the south-east. */
function paintHouse(
  sketch: p5,
  corner: { readonly x: number; readonly y: number },
  size: number,
  seed: number
) {
  const roof = seed < 0.62 ? MATERIAL.roofTerracotta : MATERIAL.roofZinc;
  const wide = size * (0.62 + 0.25 * hashUnit(seed * 1000, 3));
  const deep = size * (0.55 + 0.25 * hashUnit(seed * 1000, 7));
  const x = corner.x + (size - wide) * hashUnit(seed * 1000, 11);
  const y = corner.y + (size - deep) * hashUnit(seed * 1000, 13);
  withShadow(
    sketch,
    {
      blur: size * 0.12,
      color: fade(getColor("BLACK"), 0.55),
      drop: size * 0.08,
    },
    () => {
      gradientRect(sketch, { height: deep, width: wide, x, y }, [
        [0, mix(roof, getColor("WHITE"), 0.18)],
        [0.5, roof],
        [0.52, mix(roof, getColor("BLACK"), 0.22)],
        [1, mix(roof, getColor("BLACK"), 0.32)],
      ]);
    }
  );
}

/** One tree crown from above, a darker core under a sunlit edge, with its shadow. */
function paintTree(
  sketch: p5,
  centre: { readonly x: number; readonly y: number },
  radius: number
) {
  sketch.fill(fade(getColor("BLACK"), 0.35));
  sketch.circle(
    centre.x + radius * 0.35,
    centre.y + radius * 0.35,
    radius * 2.1
  );
  sketch.fill(MATERIAL.foliageDark);
  sketch.circle(centre.x, centre.y, radius * 2);
  sketch.fill(MATERIAL.foliageLight);
  sketch.circle(
    centre.x - radius * 0.25,
    centre.y - radius * 0.25,
    radius * 1.2
  );
}

/** The four lots of one block: three houses in four lots on average, a tree in the rest. */
function paintBlock(
  sketch: p5,
  corner: { readonly x: number; readonly y: number },
  block: {
    readonly east: number;
    readonly lot: number;
    readonly north: number;
    readonly street: number;
  }
) {
  for (let row = 0; row < 2; row += 1) {
    for (let column = 0; column < 2; column += 1) {
      const seed = hashUnit(block.east * 7 + column, block.north * 5 + row);
      const place = {
        x: corner.x + block.street / 2 + column * block.lot,
        y: corner.y + block.street / 2 + row * block.lot,
      };
      if (seed < 0.82) {
        paintHouse(sketch, place, block.lot * 0.92, seed);
      } else {
        paintTree(
          sketch,
          { x: place.x + block.lot / 2, y: place.y + block.lot / 2 },
          block.lot * 0.3
        );
      }
    }
  }
}

/** One street line along x or y: asphalt with a dashed centre line. */
function paintStreet(sketch: p5, at: number, street: number, across: boolean) {
  const length = across ? sketch.width : sketch.height;
  sketch.fill(MATERIAL.asphalt);
  if (across) {
    sketch.rect(0, at - street / 2, length, street);
  } else {
    sketch.rect(at - street / 2, 0, street, length);
  }
  sketch.fill(fade(MATERIAL.roadPaint, 0.55));
  for (let along = 0; along < length; along += 18) {
    if (across) {
      sketch.rect(along, at - 1, 9, 2);
    } else {
      sketch.rect(at - 1, along, 2, 9);
    }
  }
}

/**
 * Paints the town under a plan: grass, a street every `block` metres, and
 * on each block a few houses and trees.
 */
export function paintTown(sketch: p5, plan: Plan, block: number) {
  const { height, width } = sketch;
  gradientRect(sketch, { height, width, x: 0, y: 0 }, [
    [0, mix(MATERIAL.grass, MATERIAL.foliageLight, 0.3)],
    [1, mix(MATERIAL.grass, MATERIAL.foliageDark, 0.3)],
  ]);
  const street = Math.max(block * plan.scale * 0.16, 6);
  const span = block * plan.scale;
  const lot = (span - street) / 2;
  const firstEast = Math.floor(-plan.originX / span) - 1;
  const lastEast = Math.ceil((width - plan.originX) / span) + 1;
  const firstNorth = Math.floor((plan.originY - height) / span) - 1;
  const lastNorth = Math.ceil(plan.originY / span) + 1;
  sketch.push();
  sketch.noStroke();
  for (let east = firstEast; east <= lastEast; east += 1) {
    for (let north = firstNorth; north <= lastNorth; north += 1) {
      const corner = planPoint(plan, {
        east: east * block,
        north: (north + 1) * block,
      });
      paintBlock(sketch, corner, { east, lot, north, street });
    }
  }
  for (let east = firstEast; east <= lastEast; east += 1) {
    paintStreet(
      sketch,
      planPoint(plan, { east: east * block, north: 0 }).x,
      street,
      false
    );
  }
  for (let north = firstNorth; north <= lastNorth; north += 1) {
    paintStreet(
      sketch,
      planPoint(plan, { east: 0, north: north * block }).y,
      street,
      true
    );
  }
  sketch.pop();
}

/** A person seen from above: shoulders and head, with a shadow, at a canvas point. */
export function paintWalker(
  sketch: p5,
  at: { readonly x: number; readonly y: number },
  size: number,
  color: string
) {
  sketch.push();
  sketch.noStroke();
  sketch.fill(fade(getColor("BLACK"), 0.4));
  sketch.ellipse(
    at.x + size * 0.25,
    at.y + size * 0.25,
    size * 1.3,
    size * 0.8
  );
  sketch.fill(color);
  sketch.ellipse(at.x, at.y, size * 1.2, size * 0.7);
  sketch.fill(mix(getColor("STONE", 600), getColor("BLACK"), 0.4));
  sketch.circle(at.x, at.y, size * 0.5);
  sketch.pop();
}
