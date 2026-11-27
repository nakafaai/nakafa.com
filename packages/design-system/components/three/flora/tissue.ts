import { chanceAt } from "@repo/design-system/components/three/field/noise";
import { placeAt } from "@repo/design-system/components/three/flora/limb";
import { Array as Arr, Option, Schema } from "effect";

/**
 * How many numbers place one cell of a section: where its middle is across
 * and along the axis, how far it is turned, how wide and how tall it is, the
 * share of it its vacuole fills, the size of its nucleus beside its width,
 * the zone it lies in and a chance of its own.
 */
export const CELL_STRIDE = 9;

/** The zones of a growing axis, from its tip back: cap, division, elongation and maturation. */
export const ZONES = { cap: 0, division: 1, elongation: 2, mature: 3 } as const;

/**
 * A growing axis cut open along its length, as a microscope shows it: files
 * of cells that run the length of the axis and end on the dome of its tip.
 * `apex` is how long that dome is (0 for an axis cut square), `cap` how thick
 * the cap over the tip is (0 for a shoot, which has none), `division` and
 * `elongation` where those zones end, measured from the tip. A cell is
 * `short` where cells divide and `tall` where they have finished growing, and
 * `skew` makes the cells of one flank longer than those of the other, as
 * auxin does on the shaded side of a shoot.
 */
export const SectionSchema = Schema.Struct({
  apex: Schema.Finite,
  cap: Schema.Finite,
  division: Schema.Finite,
  elongation: Schema.Finite,
  files: Schema.Int,
  length: Schema.Finite,
  radius: Schema.Finite,
  seed: Schema.Int,
  short: Schema.Finite,
  skew: Schema.Finite,
  tall: Schema.Finite,
});
export type Section = typeof SectionSchema.Type;

/**
 * How far from the tip the surface of the axis lies at `across` of the way
 * from its middle (0) to its flank (1 or -1): nothing where the axis is cut
 * square, and the rounded dome of the tip where it is not.
 */
export function domeAt(section: Section, across: number) {
  return section.apex * (1 - Math.sqrt(Math.max(0, 1 - across * across)));
}

/** The half-width of the axis at `along` from its tip: the dome's outline, then the full radius. */
export function sectionWidth(section: Section, along: number) {
  if (along >= section.apex) {
    return section.radius;
  }
  const short = 1 - along / section.apex;
  return section.radius * Math.sqrt(Math.max(0, 1 - short * short));
}

/** What a cell is like at one place of the axis: its zone, height, vacuole and nucleus. */
function cellAt(section: Section, across: number, along: number) {
  const flank = 1 - section.skew * across;
  if (along < section.cap + domeAt(section, across) * 0.6) {
    return {
      height: section.short * 1.7,
      nucleus: 0.3,
      vacuole: 0.35,
      zone: ZONES.cap,
    };
  }
  if (along < section.division) {
    return {
      height: section.short,
      nucleus: 0.62,
      vacuole: 0.06,
      zone: ZONES.division,
    };
  }
  if (along < section.elongation) {
    const grown =
      (along - section.division) / (section.elongation - section.division);
    return {
      height:
        (section.short + (section.tall - section.short) * grown * grown) *
        flank,
      nucleus: 0.42 - 0.16 * grown,
      vacuole: 0.2 + 0.6 * grown,
      zone: ZONES.elongation,
    };
  }
  return {
    height: section.tall * flank,
    nucleus: 0.24,
    vacuole: 0.86,
    zone: ZONES.mature,
  };
}

/**
 * Every cell of a section, as `CELL_STRIDE` numbers each, with the tip of the
 * axis at the origin and the axis along +y. Each file stacks its cells from
 * the dome of the tip to the far end: small and dense where they divide, then
 * longer and longer with a growing vacuole, then full grown. No two cells are
 * the same height, so the files never line up into a grid.
 */
export function sectionCells(section: Section) {
  const wide = (2 * section.radius) / section.files;
  return Arr.flatMap(Arr.range(0, section.files - 1), (file) => {
    const across = ((file + 0.5) / section.files) * 2 - 1;
    const cells = Arr.unfold(
      { from: domeAt(section, across), index: 0 },
      ({ from, index }) => {
        const left = section.length - from;
        if (left < section.short * 0.5) {
          return Option.none();
        }
        const chance = chanceAt(file, index, section.seed);
        const cell = cellAt(section, across, from);
        const height = Math.min(left, cell.height * (0.78 + 0.44 * chance));
        return Option.some([
          [
            across * section.radius,
            from + height / 2,
            0,
            wide,
            height,
            cell.vacuole,
            cell.nucleus,
            cell.zone,
            chance,
          ],
          { from: from + height, index: index + 1 },
        ] as const);
      }
    );
    return Arr.flatten(cells);
  });
}

/**
 * The cells of a straight section laid along a bent `path` in the plane of
 * the cut: each keeps its distance from the tip and from the middle of the
 * axis and turns with the axis, so a bending shoot carries its cells with it.
 */
export function bendCells(
  cells: readonly number[],
  path: readonly (readonly [number, number, number])[]
) {
  const spans = Arr.zipWith(Arr.drop(path, 1), path, (place, before) =>
    Math.hypot(place[0] - before[0], place[1] - before[1])
  );
  const marks = Arr.scan(spans, 0, (sum, span) => sum + span);
  const last = spans.length - 1;
  return Arr.flatMap(Arr.chunksOf(cells, CELL_STRIDE), (cell) => {
    const along = Number(cell[1]);
    const span = Math.min(
      last,
      Math.max(0, Arr.filter(marks, (mark) => mark <= along).length - 1)
    );
    const start = placeAt(path, span);
    const end = placeAt(path, span + 1);
    const run = Number(spans[span]);
    const heading = [(end[0] - start[0]) / run, (end[1] - start[1]) / run];
    const past = along - Number(marks[span]);
    const across = Number(cell[0]);
    return [
      start[0] + Number(heading[0]) * past + Number(heading[1]) * across,
      start[1] + Number(heading[1]) * past - Number(heading[0]) * across,
      -Math.atan2(Number(heading[0]), Number(heading[1])),
      ...Arr.drop(cell, 3),
    ];
  });
}
