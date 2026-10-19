import { Array as Arr } from "effect";

/** A tile of the staff home. */
export type StaffTile = "drafts" | "live" | "next" | "results" | "setup";

/** A tile of the student home. */
export type StudentTile = "results" | "sittings";

/** The staff tiles in the order the home shows them: the urgent rooms first, then drafts and setup. */
const STAFF_ORDER: readonly StaffTile[] = [
  "live",
  "results",
  "next",
  "drafts",
  "setup",
];

/**
 * Which tiles a staff home shows, and whether the quiet state takes the place of Live and Next. A tile
 * with no rows is hidden, and the quiet state shows only to a viewer who may watch rooms with nothing
 * running and nothing opening soon.
 */
export const staffPlan = (counts: {
  readonly canCreate: boolean;
  readonly canWatch: boolean;
  readonly closed: number;
  readonly drafts: number;
  readonly live: number;
  readonly next: number;
  readonly setup: boolean;
}) => {
  const shown: Record<StaffTile, boolean> = {
    drafts: counts.canCreate && counts.drafts > 0,
    live: counts.live > 0,
    next: counts.next > 0,
    results: counts.closed > 0,
    setup: counts.setup,
  };
  return {
    quiet: counts.canWatch && counts.live === 0 && counts.next === 0,
    tiles: Arr.filter(STAFF_ORDER, (tile) => shown[tile]),
  };
};

/** The student tiles in the order the home shows them. */
const STUDENT_ORDER: readonly StudentTile[] = ["sittings", "results"];

/**
 * Which tiles a student home shows. A student with no sitting and no result sees the quiet state with no
 * card, and any other student sees the tiles that hold rows.
 */
export const studentPlan = (counts: {
  readonly results: number;
  readonly sittings: number;
}) => {
  const shown: Record<StudentTile, boolean> = {
    results: counts.results > 0,
    sittings: counts.sittings > 0,
  };
  const tiles = Arr.filter(STUDENT_ORDER, (tile) => shown[tile]);
  return { quiet: Arr.isReadonlyArrayEmpty(tiles), tiles };
};

/**
 * The columns that the tile at an index takes at two columns (from 600 pixels) and at three columns
 * (from 960 pixels). The first tile is the hero and takes two columns when the grid has them. A lone
 * last tile takes its whole row, so no row ends with one tile beside an empty space.
 */
export const tileSpans = (count: number) =>
  Arr.makeBy(count, (index) => ({
    three: threeColumnSpan(index, count),
    two: twoColumnSpan(index, count),
  }));

/** The columns the tile at an index takes at two columns. */
const twoColumnSpan = (index: number, count: number): 1 | 2 => {
  if (index === 0) {
    return 2;
  }
  // The singles after the hero fill rows of two, so the last one stands alone when their count is odd.
  return index === count - 1 && (count - 1) % 2 === 1 ? 2 : 1;
};

/** The columns the tile at an index takes at three columns. */
const threeColumnSpan = (index: number, count: number): 1 | 2 | 3 => {
  if (count === 1) {
    return 3;
  }
  if (index === 0) {
    return 2;
  }
  // The hero and the first single share the first row, and the singles after them fill rows of three.
  return index === count - 1 && count >= 3 && (count - 2) % 3 === 1 ? 3 : 1;
};
