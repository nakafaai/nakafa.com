import { hashUnit } from "@repo/design-system/components/contents/simulation/grain";
import { Array as Arr, Schema } from "effect";

/** The four cells a learner meets first: one from each kingdom they study. */
export const CellKindSchema = Schema.Literals([
  "animal",
  "plant",
  "yeast",
  "bacterium",
]);
export type CellKind = typeof CellKindSchema.Type;

/** The outline a cell keeps: round, boxy, egg-shaped or a rod. */
export const OutlineSchema = Schema.Literals(["sphere", "box", "egg", "rod"]);

/** One cell's size and shape in micrometres, length along x. */
export const BodySchema = Schema.Struct({
  depth: Schema.Finite,
  height: Schema.Finite,
  length: Schema.Finite,
  outline: OutlineSchema,
});
export type Body = typeof BodySchema.Type;

/**
 * Typical sizes, in micrometres, from Alberts et al., "Molecular Biology of
 * the Cell" (7th ed., 2022) and BioNumbers (Milo and Phillips, "Cell Biology
 * by the Numbers", 2015): an animal cell such as a liver cell about 20 µm
 * across, a leaf's palisade cell about 40 µm long and 24 µm wide, a baker's
 * yeast cell about 5 µm by 4 µm, and an Escherichia coli rod about 2 µm long
 * and 1 µm wide.
 */
const BODIES = {
  animal: { depth: 20, height: 20, length: 20, outline: "sphere" },
  bacterium: { depth: 1, height: 1, length: 2, outline: "rod" },
  plant: { depth: 24, height: 24, length: 40, outline: "box" },
  yeast: { depth: 4, height: 4, length: 5, outline: "egg" },
} as const satisfies Record<CellKind, Body>;

/** The size and shape of a `kind` of cell. */
export function bodyOf(kind: CellKind): Body {
  return BODIES[kind];
}

/** The longest side of a `kind` of cell, in micrometres, which the card reads out. */
export function lengthOf(kind: CellKind) {
  return BODIES[kind].length;
}

/**
 * A scale bar a little shorter than the cell: the largest of 1, 2 and 5 times
 * a power of ten that fits in half of its length.
 */
export function scaleBar(length: number) {
  const half = length / 2;
  const power = 10 ** Math.floor(Math.log10(half));
  return Arr.reduce([1, 2, 5], power, (best, step) =>
    step * power <= half ? step * power : best
  );
}

/**
 * One cycle of a budding yeast cell in rich broth at 30 °C takes about
 * 90 minutes (Sherman, "Getting Started with Yeast", Methods in Enzymology
 * 350, 2002).
 */
export const BUD_MINUTES = 90;

/** The bud appears a fifth of the way into the cycle, once the cell has copied its DNA's start. */
const BUD_START = 0.2;

/** A daughter leaves at about four fifths of her mother's length. */
const BUD_FULL = 0.8;

/**
 * The bud's length as a share of the mother's at `minutes` into the cycle:
 * nothing before it emerges, then growing smoothly to its full size as the
 * cycle ends. Time outside one cycle wraps into it.
 */
export function budShare(minutes: number) {
  const cycle =
    (((minutes % BUD_MINUTES) + BUD_MINUTES) % BUD_MINUTES) / BUD_MINUTES;
  if (cycle < BUD_START) {
    return 0;
  }
  const grown = (cycle - BUD_START) / (1 - BUD_START);
  return BUD_FULL * Math.sqrt(grown);
}

/** Whether the nucleus has moved into the neck to divide, late in the cycle. */
export function isDividing(minutes: number) {
  return budShare(minutes) > BUD_FULL * 0.85;
}

/**
 * The sizes a learner compares when zooming from a cell down to a virus, in
 * micrometres: an animal cell, an Escherichia coli rod, and a SARS-CoV-2
 * virion about 0.1 µm across (Ke et al., Nature 588, 2020; Bar-On et al.,
 * eLife 9, 2020).
 */
export const SIZES = {
  bacterium: 2,
  cell: 20,
  virion: 0.1,
} as const;

/** How many times longer `larger` is than `smaller`. */
export function timesLarger(larger: number, smaller: number) {
  return larger / smaller;
}

/**
 * The width of the view, in micrometres, at a zoom of `share` from 0 (the
 * whole cell, 50 µm across) to 1 (a single virion, 0.25 µm across). Each step
 * of the slider multiplies the view by the same factor, as a microscope's
 * objectives do.
 */
export function viewWidth(share: number) {
  const widest = 50;
  const narrowest = 0.25;
  const clamped = Math.min(1, Math.max(0, share));
  return widest * (narrowest / widest) ** clamped;
}

/**
 * A seeded spot inside the back half of a unit ball, kept `margin` from its
 * skin and its cut, so organelles never poke through either.
 */
export function spotInHalf(index: number, salt: number, margin: number) {
  const radius = (1 - margin) * Math.cbrt(hashUnit(index, salt));
  const theta = Math.acos(2 * hashUnit(index, salt + 1) - 1);
  const phi = Math.PI + hashUnit(index, salt + 2) * Math.PI;
  const x = radius * Math.sin(theta) * Math.cos(phi);
  const y = radius * Math.cos(theta);
  const z = Math.min(-margin, radius * Math.sin(theta) * Math.sin(phi));
  return [x, y, z] as const;
}

/** Where the virion sits beside the cell and the bacterium, in micrometres along x. */
export const LINEUP = { bacterium: 11.8, cell: 0, virion: 13.3 } as const;

/**
 * The point the zoom centres on at a view `width` µm wide: the cell's middle
 * when the whole cell shows, the bacterium and the virion together near
 * 5 µm, and the virion alone at the closest zoom. The path follows the
 * zoom's own logarithmic steps, eased at both ends.
 */
export function focusAt(width: number) {
  const steps = Math.log(50 / width) / Math.log(200);
  const share = Math.min(1, Math.max(0, steps / 0.55));
  const eased = share * share * (3 - 2 * share);
  return LINEUP.virion * eased;
}
