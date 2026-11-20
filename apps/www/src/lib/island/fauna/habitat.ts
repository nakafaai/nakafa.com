import { Array as Arr, Option, Order, Record as Rec, Schema } from "effect";
import type { Cover, Land } from "@/lib/island/land/ground";
import {
  coverAt,
  depthAt,
  elevationAt,
  slopeAt,
} from "@/lib/island/land/ground";
import { unitOf } from "@/lib/island/noise";

/** The side of one cell of life, in blocks (ADR 0050, W9): two chunks by two. */
export const CELL = 64;

/** How far apart a cell's land is read, in blocks. */
const STEP = 4;

/**
 * The places the land offers its life (ADR 0050, W9): the open sea, the
 * shallows where a reef grows, fresh water (a river or a lake), a shore of
 * sand, a flower meadow, open grass, a forest's floor, and the high terraces.
 */
export const Habitat = Schema.Literals([
  "sea",
  "shallows",
  "fresh",
  "shore",
  "meadow",
  "grass",
  "forest",
  "highland",
]);
export type Habitat = typeof Habitat.Type;

/**
 * What decides a habitat: water deeper than `wet` is water, the sea deeper
 * than `deep` is open sea, land steeper than `steep` is a cliff where nothing
 * lives, and land higher than `high` over the sea is highland.
 */
const LIMIT = {
  deep: 3,
  high: 13,
  shore: 0.3,
  steep: 0.75,
  wet: 0.05,
} as const;

/** The habitat of dry ground by what covers it; a path is open grass. */
const COVERS = {
  forest: "forest",
  grass: "grass",
  meadow: "meadow",
  path: "grass",
  sand: "shore",
} as const satisfies Record<Cover, Habitat>;

/** The habitat a place is, from what the land is there, none on a cliff. */
export function habitatOf(site: {
  readonly cover: Cover;
  readonly depth: number;
  readonly elevation: number;
  readonly slope: number;
}): Option.Option<Habitat> {
  if (site.depth > LIMIT.wet) {
    if (site.elevation > LIMIT.shore) {
      return Option.some("fresh");
    }
    return Option.some(site.depth >= LIMIT.deep ? "sea" : "shallows");
  }
  if (site.slope > LIMIT.steep) {
    return Option.none();
  }
  return Option.some(
    site.elevation > LIMIT.high && site.cover !== "sand"
      ? "highland"
      : COVERS[site.cover]
  );
}

/** The habitat at a place of the land. */
export function habitatAt(land: Land, x: number, z: number) {
  return habitatOf({
    cover: coverAt(land, x, z),
    depth: depthAt(land, x, z),
    elevation: elevationAt(land, x, z),
    slope: slopeAt(land, x, z),
  });
}

/** The key of the cell of life at these cell coordinates, either of which may be negative. */
export function cellKey(gx: number, gz: number) {
  return (gx + 32_768) * 65_536 + (gz + 32_768);
}

/**
 * What one cell of the land offers its life (ADR 0050, W9): for each habitat,
 * the places of the cell that are it and how deep water stands there, in an
 * order the seed and the place decide, so the same cell always offers the
 * same spots first.
 */
export function surveyOf(land: Land, gx: number, gz: number) {
  const side = CELL / STEP;
  const spots = Arr.makeBy(side * side, (slot) => {
    const x = gx * CELL + (slot % side) * STEP + STEP / 2;
    const z = gz * CELL + Math.floor(slot / side) * STEP + STEP / 2;
    return {
      depth: depthAt(land, x, z),
      habitat: habitatAt(land, x, z),
      order: unitOf(land.seed + 211, x, 0, z),
      x,
      z,
    };
  });
  const ordered = Arr.sort(
    spots,
    Order.mapInput(Order.Number, (spot: (typeof spots)[number]) => spot.order)
  );
  return Rec.fromEntries(
    Arr.map(
      Habitat.literals,
      (habitat) =>
        [
          habitat,
          Arr.filter(ordered, (spot) => Option.contains(spot.habitat, habitat)),
        ] as const
    )
  );
}
export type Survey = ReturnType<typeof surveyOf>;
