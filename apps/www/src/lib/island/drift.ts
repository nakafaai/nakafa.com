import { idOf } from "@repo/backend/confect/island/blocks";
import { HEIGHT, SPAN } from "@repo/backend/confect/island/world";
import { Array as Arr, Option } from "effect";
import { KIND, LOOK } from "@/lib/island/look";
import { unitOf } from "@/lib/island/noise";
import { isPlantBlock } from "@/lib/island/plants";
import type { Season } from "@/lib/island/season";
import { leafToneOf } from "@/lib/island/season";
import type { Cells } from "@/lib/island/world";
import { blockAt, cellOf } from "@/lib/island/world";

const LEAVES = idOf("leaves");
const FLOWERS = idOf("flowers");

/** The share of flowers a butterfly calls home: about one in three. */
const BUTTERFLY_SHARE = 0.34;

/**
 * How each season drifts from the crowns (ADR 0047, D41): the share of a
 * crown's underside that lets a leaf go, and the tone of the season's leaves
 * it falls in. Autumn sheds most, in its orange; spring drops blossom, the
 * pink highlight of its leaves; the dry season sheds some; summer and the wet
 * season let a green leaf go now and then; winter's crowns hold nothing.
 */
const SHED = {
  autumn: { share: 0.35, tone: 2 },
  dry: { share: 0.15, tone: 2 },
  spring: { share: 0.2, tone: 3 },
  summer: { share: 0.05, tone: 2 },
  wet: { share: 0.05, tone: 2 },
  winter: { share: 0, tone: 2 },
} as const satisfies Record<Season, unknown>;

/** How much a season sheds and the color it sheds in, from 0 to 1. */
export function shedOf(season: Season) {
  const { share, tone } = SHED[season];
  const [red, green, blue] = leafToneOf(season, tone);
  return { color: [red / 255, green / 255, blue / 255] as const, share };
}

/** The height a leaf lands at under a cell: over the highest solid block below it, 0 over an empty column. */
function floorUnder(cells: Cells, x: number, y: number, z: number) {
  return Option.match(
    Arr.findFirst(
      Arr.makeBy(y, (step) => y - 1 - step),
      (below) => LOOK.kinds[blockAt(cells, x, below, z)] === KIND.solid
    ),
    { onNone: () => 0, onSome: (below) => below + 1 }
  );
}

/**
 * Where leaves fall from: every leaf block with air under it, the underside
 * of a crown, as the point under the middle of the block and the height of
 * the ground under it, four numbers a crown. The column map gives only the
 * first thing over a column, which under a tree is the crown itself. Which
 * crowns shed is the season's share, picked on the GPU.
 */
export function crownsOf(cells: Cells) {
  return Float32Array.from(
    Arr.flatMap(Arr.range(0, SPAN * SPAN * (HEIGHT - 1) - 1), (index) => {
      const x = index % SPAN;
      const z = Math.floor(index / SPAN) % SPAN;
      const y = Math.floor(index / (SPAN * SPAN)) + 1;
      const underside =
        cells[cellOf(x, y, z)] === LEAVES && blockAt(cells, x, y - 1, z) === 0;
      return underside ? [x + 0.5, y, z + 0.5, floorUnder(cells, x, y, z)] : [];
    })
  );
}

/**
 * Where butterflies fly by day: about one flower in three, a wild flower or
 * a flower of the catalog, picked by the seed so a garden keeps its
 * butterflies. Each home is the point over the flower's middle.
 */
export function butterfliesOf(cells: Cells, seed: number) {
  return Float32Array.from(
    Arr.flatMap(Arr.range(0, SPAN * SPAN * HEIGHT - 1), (index) => {
      const x = index % SPAN;
      const z = Math.floor(index / SPAN) % SPAN;
      const y = Math.floor(index / (SPAN * SPAN));
      const block = cells[cellOf(x, y, z)];
      const flower =
        (block === FLOWERS || isPlantBlock(block)) &&
        unitOf(seed + 71, x, y, z) < BUTTERFLY_SHARE;
      return flower ? [x + 0.5, y + 1, z + 0.5] : [];
    })
  );
}
