import type { Lead } from "@repo/design-system/components/three/apparatus/route";
import { Array as Arr } from "effect";

/** A place on the bench, in metres: x to the right, y up, z toward the viewer. */
type Point = readonly [number, number, number];

/** Metres per scene unit: a cell is laid out at ten units to the metre. */
export const BENCH = 0.1;

/** Half the distance between a cell's two electrodes, in scene units. */
export const ELECTRODE_OFFSET = 0.2;

/** The height of an electrode's top, where its lead clips on, in scene units. */
export const ELECTRODE_TOP = 1.07;

/** How far apart neighbouring cells stand, middle to middle, in scene units. */
const CELL_SPACING = 1.6;

/** How far a lead's middle stands above its ends, in metres: to the battery, and from cell to cell. */
const LIFT = { link: 0.02, pack: 0.05 } as const;

/** The x of each cell's middle, the row centred on the battery, in scene units. */
export function cellCentres(count: number) {
  return Arr.makeBy(count, (index) => centreOf(index, count));
}

/**
 * The leads of a circuit of cells in series, in metres, each written in the
 * direction electrons travel along it: out of the first anode's clip to the
 * battery's positive terminal, from each anode across to the cathode of the
 * cell before it, and from the negative post into the last cathode's clip.
 * Each cell's anode is its left electrode.
 *
 * @param count - How many cells stand in the row
 * @param posts - Where the battery's positive and negative terminals are, in metres
 */
export function circuitLeads(
  count: number,
  posts: readonly [Point, Point]
): Arr.NonEmptyReadonlyArray<Lead> {
  const centres = cellCentres(count);
  const top = ELECTRODE_TOP * BENCH;
  const firstAnode = (centreOf(0, count) - ELECTRODE_OFFSET) * BENCH;
  const lastCathode = (centreOf(count - 1, count) + ELECTRODE_OFFSET) * BENCH;
  const links = Arr.map(
    Arr.zip(centres, Arr.drop(centres, 1)),
    ([left, right]): Lead => ({
      ends: ["clip", "clip"],
      from: [(right - ELECTRODE_OFFSET) * BENCH, top, 0],
      lift: LIFT.link,
      to: [(left + ELECTRODE_OFFSET) * BENCH, top, 0],
    })
  );

  return [
    {
      ends: ["clip", "plug"],
      from: [firstAnode, top, 0],
      lift: LIFT.pack,
      to: posts[0],
    },
    ...links,
    {
      ends: ["plug", "clip"],
      from: posts[1],
      lift: LIFT.pack,
      to: [lastCathode, top, 0],
    },
  ];
}

/** The x of one cell's middle in a row of `count`. */
function centreOf(index: number, count: number) {
  return (index - (count - 1) / 2) * CELL_SPACING;
}
