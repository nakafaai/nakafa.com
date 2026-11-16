import {
  fade,
  mix,
} from "@repo/design-system/components/contents/physics/canvas/paint";
import { hashUnit } from "@repo/design-system/components/contents/simulation/grain";
import { getColor } from "@repo/design-system/lib/color";
import { MATERIAL } from "@repo/design-system/lib/material";
import type p5 from "p5";

/** Fields across one side of the tile. */
const FIELDS = 8;

/** The crops and bare soil a field may show from cruising height. */
const CROPS = [
  MATERIAL.wheatField,
  MATERIAL.grass,
  MATERIAL.foliageLight,
  MATERIAL.riverbank,
  MATERIAL.foliageShade,
  mix(MATERIAL.wheatField, MATERIAL.grass, 0.5),
] as const;

/** One field: its crop in one or three strips, its furrows, and sometimes a farmhouse. */
function paintField(layer: p5, column: number, row: number, cell: number) {
  const x = column * cell;
  const y = row * cell;
  const crop =
    CROPS[Math.floor(hashUnit(column, row) * CROPS.length)] ?? MATERIAL.grass;
  const strips = hashUnit(column + 31, row) < 0.4 ? 3 : 1;
  for (let strip = 0; strip < strips; strip += 1) {
    layer.fill(
      mix(
        crop,
        strip % 2 === 0 ? getColor("WHITE") : getColor("BLACK"),
        0.06 + hashUnit(column, row + strip * 7) * 0.08
      )
    );
    layer.rect(x, y + (cell / strips) * strip, cell, cell / strips + 1);
  }
  layer.fill(fade(getColor("BLACK"), 0.05));
  for (let furrow = 0; furrow < cell; furrow += 4) {
    layer.rect(x, y + furrow, cell, 1);
  }
  if (hashUnit(column, row + 101) < 0.18) {
    layer.fill(fade(getColor("BLACK"), 0.3));
    layer.rect(x + cell * 0.42, y + cell * 0.42, cell * 0.1, cell * 0.08);
    layer.fill(MATERIAL.roofTerracotta);
    layer.rect(x + cell * 0.4, y + cell * 0.4, cell * 0.1, cell * 0.08);
  }
}

/** The farm tracks and tree lines along some of the field edges. */
function paintEdges(layer: p5, cell: number) {
  for (let line = 0; line <= FIELDS; line += 1) {
    const at = line * cell;
    if (hashUnit(line, 3) < 0.5) {
      layer.fill(MATERIAL.gravel);
      layer.rect(at - 1.5, 0, 3, layer.height);
    }
    if (hashUnit(line, 5) < 0.45) {
      layer.fill(MATERIAL.foliageDark);
      for (let tree = 0; tree < layer.width; tree += 7) {
        layer.circle(tree, at, 5 + hashUnit(tree, line) * 3);
      }
    }
  }
}

/**
 * Paints farmland seen from ten kilometres up into a square layer that tiles
 * without a seam: a grid of fields in crops and bare soil, some split in
 * strips, with farm tracks and tree lines along their edges and a farmhouse
 * here and there. Every field looks the same on every visit, because its
 * look comes from a hash of its place.
 */
export function paintFarmland(layer: p5) {
  const cell = layer.width / FIELDS;
  layer.noStroke();
  for (let column = 0; column < FIELDS; column += 1) {
    for (let row = 0; row < FIELDS; row += 1) {
      paintField(layer, column, row, cell);
    }
  }
  paintEdges(layer, cell);
}
