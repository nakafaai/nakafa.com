import { hashUnit } from "@repo/design-system/components/contents/simulation/grain";
import { Array as Arr, Match, Result, Schema } from "effect";

/** The stage of a root-tip cell in the cell cycle, as a squash shows it. */
const PhaseSchema = Schema.Literals([
  "interphase",
  "prophase",
  "metaphase",
  "anaphase",
  "telophase",
]);
type Phase = typeof PhaseSchema.Type;

/** A point on the slide, in the field's units. */
const SpotSchema = Schema.Tuple([Schema.Finite, Schema.Finite]);
type Spot = typeof SpotSchema.Type;

/**
 * One cell on the slide: its outline as a closed polygon, its nucleus, and
 * its phase in the cell cycle, all in the field's units, with the slide in
 * the x–z plane.
 */
const SlideCellSchema = Schema.Struct({
  nucleus: SpotSchema,
  nucleusRadius: Schema.Finite,
  outline: Schema.Array(SpotSchema),
  phase: PhaseSchema,
});
export type SlideCell = typeof SlideCellSchema.Type;

/**
 * The phase of a root-tip cell whose random draw is `draw`, from 0 to 1, at
 * the shares a squash shows: three cells in four in interphase, a tenth in
 * prophase, and a twentieth in each of the other stages.
 */
export function phaseOf(draw: number): Phase {
  if (draw < 0.75) {
    return "interphase";
  }
  if (draw < 0.85) {
    return "prophase";
  }
  if (draw < 0.9) {
    return "metaphase";
  }
  return draw < 0.95 ? "anaphase" : "telophase";
}

/** Whether a spot lies within `reach` of the field's middle. */
function inside(spot: Spot, reach: number) {
  return Math.hypot(spot[0], spot[1]) <= reach;
}

/** A rectangle's corners, `length` along x and `width` along z, around `middle`. */
function box(middle: Spot, length: number, width: number): readonly Spot[] {
  const [x, z] = middle;
  const a = length / 2;
  const b = width / 2;
  return [
    [x - a, z - b],
    [x + a, z - b],
    [x + a, z + b],
    [x - a, z + b],
  ];
}

/**
 * Cheek cells: flat, irregular polygons about `size` across, packed loosely
 * edge to edge, each with a small round nucleus off its middle.
 */
function cheekCells(size: number, reach: number): readonly SlideCell[] {
  const step = size * 1.02;
  const rows = Math.ceil(reach / (step * 0.87)) + 1;
  const columns = Math.ceil(reach / step) + 1;
  return Arr.flatMap(Arr.range(-rows, rows), (row) =>
    Arr.filterMap(Arr.range(-columns, columns), (column) => {
      const seed = row * 977 + column;
      const middle: Spot = [
        (column + (row % 2 === 0 ? 0 : 0.5)) * step +
          (hashUnit(seed, 1) - 0.5) * size * 0.3,
        row * step * 0.87 + (hashUnit(seed, 2) - 0.5) * size * 0.3,
      ];
      // A smear leaves gaps: about one place in seven holds no cell.
      if (!inside(middle, reach + size) || hashUnit(seed, 30) < 0.14) {
        return Result.failVoid;
      }
      const outline = Arr.map(Arr.range(0, 8), (corner) => {
        const angle = (corner / 9) * Math.PI * 2 + hashUnit(seed, 3) * 0.6;
        const radius = (size / 2) * (0.82 + 0.28 * hashUnit(seed, corner + 4));
        return [
          middle[0] + Math.cos(angle) * radius,
          middle[1] + Math.sin(angle) * radius,
        ] as const;
      });
      return Result.succeed({
        nucleus: [
          middle[0] + (hashUnit(seed, 20) - 0.5) * size * 0.2,
          middle[1] + (hashUnit(seed, 21) - 0.5) * size * 0.2,
        ] as const,
        nucleusRadius: size * 0.11,
        outline,
        phase: "interphase" as const,
      });
    })
  );
}

/**
 * Onion epidermis: long, brick-shaped cells `size` long and a third as wide,
 * in rows whose cells are staggered by half a length, each with a nucleus.
 */
function onionCells(size: number, reach: number): readonly SlideCell[] {
  const width = size / 3;
  const rows = Math.ceil(reach / width) + 1;
  const columns = Math.ceil(reach / size) + 1;
  return Arr.flatMap(Arr.range(-rows, rows), (row) =>
    Arr.filterMap(Arr.range(-columns, columns), (column) => {
      const middle: Spot = [
        (column + (row % 2 === 0 ? 0 : 0.5)) * size,
        row * width,
      ];
      if (!inside(middle, reach + size)) {
        return Result.failVoid;
      }
      const seed = row * 613 + column;
      return Result.succeed({
        nucleus: [
          middle[0] + (hashUnit(seed, 5) - 0.5) * size * 0.5,
          middle[1],
        ] as const,
        nucleusRadius: width * 0.18,
        outline: box(middle, size, width),
        phase: "interphase" as const,
      });
    })
  );
}

/** A corner of the root-tip grid, nudged off true so the cells look grown, not ruled. */
function rootCorner(row: number, column: number, size: number): Spot {
  return [
    (column + (hashUnit(row * 71 + column, 13) - 0.5) * 0.22) * size,
    (row + (hashUnit(row * 53 + column, 17) - 0.5) * 0.22) * size,
  ];
}

/**
 * A squash of an onion root tip: small, roughly square cells `size` across
 * in the files a root grows them in, each in one stage of the cell cycle at
 * the share a real squash shows.
 */
function rootCells(size: number, reach: number): readonly SlideCell[] {
  const count = Math.ceil(reach / size) + 1;
  return Arr.flatMap(Arr.range(-count, count), (row) =>
    Arr.filterMap(Arr.range(-count, count), (column) => {
      const outline = [
        rootCorner(row, column, size),
        rootCorner(row, column + 1, size),
        rootCorner(row + 1, column + 1, size),
        rootCorner(row + 1, column, size),
      ] as const;
      const middle: Spot = [(column + 0.5) * size, (row + 0.5) * size];
      if (!inside(middle, reach + size)) {
        return Result.failVoid;
      }
      return Result.succeed({
        nucleus: middle,
        nucleusRadius: size * 0.2,
        outline,
        phase: phaseOf(hashUnit(row * 389 + column, 9)),
      });
    })
  );
}

/** The cells of a specimen `size` across, in the field's units, out to `reach`. */
export function slideCells(
  specimen: "cheek" | "onion" | "root",
  size: number,
  reach: number
) {
  return Match.value(specimen).pipe(
    Match.when("cheek", () => cheekCells(size, reach)),
    Match.when("onion", () => onionCells(size, reach)),
    Match.when("root", () => rootCells(size, reach)),
    Match.exhaustive
  );
}

/**
 * The engraved lines of a stage micrometer across the field: one every
 * `spacing` field units, longer every fifth and every tenth, out to
 * `reach` either side of the middle.
 */
export function micrometerLines(spacing: number, reach: number) {
  const count = Math.floor(reach / spacing);
  return Arr.map(Arr.range(-count, count), (index) => ({
    length: index % 10 === 0 ? 1 : index % 5 === 0 ? 0.7 : 0.45,
    x: index * spacing,
  }));
}
