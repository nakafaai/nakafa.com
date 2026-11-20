import { Array as Arr, Schema } from "effect";

/**
 * The pressures of one capillary bed, in millimetres of mercury: the blood
 * pressure at the arterial and the venous end of the capillary, the osmotic
 * pull of the plasma proteins, and the pressure and the protein pull of the
 * tissue fluid outside it.
 */
const BedSchema = Schema.Struct({
  arterial: Schema.Finite,
  oncotic: Schema.Finite,
  tissue: Schema.Struct({ oncotic: Schema.Finite, pressure: Schema.Finite }),
  venous: Schema.Finite,
});
export type Bed = typeof BedSchema.Type;

/**
 * The textbook capillary: blood enters at about 35 mmHg and leaves at about
 * 18 mmHg, the plasma proteins pull with about 25 mmHg all along, and the
 * tissue fluid's pressure and pull are "essentially negligible".
 *
 * Source: OpenStax Anatomy and Physiology 2e, 20.3 "Capillary Exchange",
 * https://openstax.org/books/anatomy-and-physiology-2e/pages/20-3-capillary-exchange
 */
export const TEXTBOOK: Bed = {
  arterial: 35,
  oncotic: 25,
  tissue: { oncotic: 0, pressure: 0 },
  venous: 18,
};

/**
 * The fluid all the body's capillaries filter and take back in a day, in
 * litres: about 24 litres leave the blood and 20.4 litres return, so about
 * 15% stays in the tissues and drains into the lymph capillaries.
 *
 * Source: OpenStax Anatomy and Physiology 2e, 20.3 "Capillary Exchange",
 * "The Role of Lymphatic Capillaries".
 */
export const DAILY = { filtered: 24, reabsorbed: 20.4 } as const;

/**
 * The capillary's blood pressure at a point `along` it, from 0 at the
 * arterial end to 1 at the venous end. Textbooks draw it falling in a
 * straight line between the two ends (OpenStax Anatomy and Physiology 2e,
 * Figure 20.16), and the lab does the same.
 */
export function capillaryPressure(bed: Bed, along: number) {
  return bed.arterial + (bed.venous - bed.arterial) * along;
}

/**
 * The net filtration pressure at a point `along` the capillary, the Starling
 * relation: the blood pressure pushing out less the tissue fluid pressing
 * back, minus the plasma proteins' pull less the tissue fluid's own pull.
 * Above zero fluid leaves the blood; below zero it returns.
 *
 * Source: OpenStax Anatomy and Physiology 2e, 20.3; Guyton and Hall,
 * Textbook of Medical Physiology, 13th ed., Chapter 16, "Starling Forces".
 */
export function netPressure(bed: Bed, along: number) {
  return (
    capillaryPressure(bed, along) -
    bed.tissue.pressure -
    (bed.oncotic - bed.tissue.oncotic)
  );
}

/**
 * Where along the capillary filtration turns to reabsorption, as a share of
 * its length: where the net pressure crosses zero. A capillary that filters
 * all the way turns at its venous end, 1; one that takes fluid back all the
 * way turns at its arterial end, 0.
 */
export function turning(bed: Bed) {
  const start = netPressure(bed, 0);
  const fall = start - netPressure(bed, 1);
  return Math.min(1, Math.max(0, start / fall));
}

/**
 * The fluid that crosses the wall from the arterial end up to `along`, per
 * unit of the arterial end's permeability: the net pressure times the wall's
 * permeability, summed along the capillary. Fluid leaving counts positive.
 * The wall lets fluid through `1 + rise × along` times as readily as at the
 * arterial end, so the integral of (1 + r x)(a - s x) is written out.
 */
function crossed(bed: Bed, along: number, rise: number) {
  const start = netPressure(bed, 0);
  const fall = start - netPressure(bed, 1);
  return (
    start * along +
    ((rise * start - fall) * along ** 2) / 2 -
    (rise * fall * along ** 3) / 3
  );
}

/**
 * How much more readily the wall lets fluid through at the venous end than
 * at the arterial end, less one. Venous capillaries are more numerous and
 * more permeable than arterial ones, so a smaller inward pressure takes back
 * most of the fluid a larger outward pressure pushed out (Guyton and Hall,
 * 13th ed., Chapter 16). The lab finds the rise that makes the textbook
 * capillary take back the share of its filtrate the whole body does,
 * 20.4 of 24 litres a day. The two volumes are both linear in the rise, so
 * the rise solves one linear equation.
 */
function calibratedRise() {
  const kept = 1 - DAILY.reabsorbed / DAILY.filtered;
  const end = turning(TEXTBOOK);
  const net = (rise: number) => crossed(TEXTBOOK, 1, rise);
  const filtered = (rise: number) => crossed(TEXTBOOK, end, rise);
  // net(r) = kept × filtered(r), with net(r) = n0 + n1 r and filtered(r) = f0 + f1 r.
  const n0 = net(0);
  const f0 = filtered(0);
  return (kept * f0 - n0) / (net(1) - n0 - kept * (filtered(1) - f0));
}

/** The rise of the wall's permeability from the arterial to the venous end. */
export const RISE = calibratedRise();

/**
 * How readily the wall lets fluid through at a point `along` the capillary,
 * against its arterial end.
 */
export function permeability(along: number) {
  return 1 + RISE * along;
}

/**
 * The fluid crossing the wall at a point `along` the capillary, per unit
 * length: positive where it leaves the blood, negative where it returns.
 */
export function flux(bed: Bed, along: number) {
  return permeability(along) * netPressure(bed, along);
}

/**
 * The fluid one capillary filters out along its arterial stretch and takes
 * back along its venous stretch, in units of the arterial end's permeability
 * times its length times one millimetre of mercury.
 */
export function exchange(bed: Bed) {
  const end = turning(bed);
  const filtered = crossed(bed, end, RISE);
  return {
    filtered,
    reabsorbed: filtered - crossed(bed, 1, RISE),
  };
}

/**
 * The share of the filtered fluid the capillary does not take back, which
 * stays in the tissue until the lymph capillaries drain it. A capillary that
 * filters nothing leaves nothing; one that takes back more than it filtered
 * leaves nothing either.
 */
export function lymphShare(bed: Bed) {
  const { filtered, reabsorbed } = exchange(bed);
  if (filtered <= 0) {
    return 0;
  }
  return Math.max(0, 1 - reabsorbed / filtered);
}

/**
 * The fluid one capillary leaves in the tissue: what it filters less what it
 * takes back, never below zero.
 */
export function leftover(bed: Bed) {
  const { filtered, reabsorbed } = exchange(bed);
  return Math.max(0, filtered - reabsorbed);
}

/**
 * How far the tissue swells, from 0 for the textbook capillary to 1 for the
 * most fluid the lab's sliders can leave behind, `worst`. The drawing reads
 * it on a square-root scale so a small rise already shows.
 */
export function swelling(bed: Bed, worst: Bed) {
  const normal = leftover(TEXTBOOK);
  const most = leftover(worst) - normal;
  if (most <= 0) {
    return 0;
  }
  return Math.sqrt(Math.min(1, Math.max(0, leftover(bed) - normal) / most));
}

/** How many halvings find a point along the capillary to well within a hair of its length. */
const HALVINGS = 30;

/**
 * Finds where the running total `total` reaches `target` between `low` and
 * `high`, for a total that only grows over that stretch.
 */
function solve(
  total: (along: number) => number,
  target: number,
  low: number,
  high: number
) {
  return Arr.reduce(Arr.range(1, HALVINGS), { high, low }, (range) => {
    const middle = (range.low + range.high) / 2;
    return total(middle) < target
      ? { high: range.high, low: middle }
      : { high: middle, low: range.low };
  });
}

/**
 * Where along the capillary a share `unit` of the filtered fluid has left,
 * from 0 to 1: fluid leaving at `leaving(bed, u)` for evenly spread `u`
 * leaves as densely as the wall filters it.
 */
export function leaving(bed: Bed, unit: number) {
  const end = turning(bed);
  const target = unit * crossed(bed, end, RISE);
  const range = solve((along) => crossed(bed, along, RISE), target, 0, end);
  return (range.low + range.high) / 2;
}

/**
 * Where along the capillary a share `unit` of the reabsorbed fluid has
 * returned, from the turning point to the venous end.
 */
export function returning(bed: Bed, unit: number) {
  const start = turning(bed);
  const peak = crossed(bed, start, RISE);
  const target = unit * (peak - crossed(bed, 1, RISE));
  const range = solve(
    (along) => peak - crossed(bed, along, RISE),
    target,
    start,
    1
  );
  return (range.low + range.high) / 2;
}

/**
 * The range the blood pressure slider spans, in millimetres of mercury: from
 * 20 to 60, widened to hold the bed's own pressure, and always above the
 * venous end, since blood flows from the higher pressure to the lower.
 */
export function arterialRange(bed: Bed) {
  return {
    max: Math.max(60, bed.arterial),
    min: Math.max(Math.min(20, bed.arterial), Math.floor(bed.venous) + 1),
  };
}

/**
 * The range the plasma protein slider spans, in millimetres of mercury: from
 * 10, low enough to show what too little plasma protein does, as when a
 * child eats too little protein (kwashiorkor), to 35, widened to hold the
 * bed's own pull.
 */
export function oncoticRange(bed: Bed) {
  return {
    max: Math.max(35, bed.oncotic),
    min: Math.min(10, bed.oncotic),
  };
}
