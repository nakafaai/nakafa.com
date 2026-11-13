import { Schema } from "effect";
import { MATERIAL } from "@repo/design-system/lib/material";

/**
 * The steps of a Gram stain, in order: the smear before staining, crystal
 * violet, Gram's iodine, the alcohol rinse, and the safranin counterstain,
 * as the American Society for Microbiology's "Gram Stain Protocols" (Smith
 * and Hussey, 2005) lays them out.
 */
export const StainStepSchema = Schema.Literals([
  "smear",
  "violet",
  "iodine",
  "alcohol",
  "safranin",
]);
export type StainStep = typeof StainStepSchema.Type;

/** Gram-positive walls keep the violet; Gram-negative walls lose it to alcohol. */
export const GramSchema = Schema.Literals(["positive", "negative"]);
export type Gram = typeof GramSchema.Type;

/** The colour a cell shows under the microscope after each step. */
const STAIN = {
  negative: {
    alcohol: MATERIAL.cellUnstained,
    iodine: MATERIAL.iodineComplex,
    safranin: MATERIAL.safranin,
    smear: MATERIAL.cellUnstained,
    violet: MATERIAL.crystalViolet,
  },
  positive: {
    alcohol: MATERIAL.iodineComplex,
    iodine: MATERIAL.iodineComplex,
    safranin: MATERIAL.iodineComplex,
    smear: MATERIAL.cellUnstained,
    violet: MATERIAL.crystalViolet,
  },
} satisfies Record<Gram, Record<StainStep, string>>;

/**
 * The colour of a cell with a `gram` wall after `step`. Crystal violet
 * colours every cell; iodine locks it in as a complex; alcohol washes it out
 * of the thin, outer-membrane wall of a Gram-negative cell only; safranin
 * then colours those pale cells pink while purple hides it in the others.
 */
export function stainOf(gram: Gram, step: StainStep) {
  return STAIN[gram][step];
}

/** The colour a learner names for a cell under the microscope. */
export const HueSchema = Schema.Literals(["clear", "purple", "pink"]);
export type Hue = typeof HueSchema.Type;

/** The colour a learner sees on a cell with a `gram` wall after `step`. */
export function hueOf(gram: Gram, step: StainStep): Hue {
  if (keepsViolet(gram, step)) {
    return "purple";
  }
  return step === "safranin" ? "pink" : "clear";
}

/** Whether a cell still holds the crystal violet after `step`. */
export function keepsViolet(gram: Gram, step: StainStep) {
  if (step === "smear") {
    return false;
  }
  return gram === "positive" || step === "violet" || step === "iodine";
}

/**
 * The doubling time of Escherichia coli growing in rich LB broth at 37 °C,
 * in minutes: about twenty, as Sezonov, Joseleau-Petit and D'Ari report in
 * "Escherichia coli Physiology in Luria-Bertani Broth" (Journal of
 * Bacteriology 189, 2007).
 */
export const DOUBLING_MINUTES = 20;

/** How many cells one cell has become after `minutes`, dividing in step. */
export function cellsAfter(minutes: number) {
  return 2 ** generationsAfter(minutes);
}

/** How many divisions have happened after `minutes`. */
export function generationsAfter(minutes: number) {
  return Math.max(0, Math.floor(minutes / DOUBLING_MINUTES));
}

/** How far through its current division cycle every cell is, from 0 to 1. */
export function cycleProgress(minutes: number) {
  const inCycle = Math.max(0, minutes) % DOUBLING_MINUTES;
  return inCycle / DOUBLING_MINUTES;
}

/**
 * How Escherichia coli swims, from Howard Berg's "E. coli in Motion"
 * (Springer, 2004): about 25 µm/s along a run that lasts about a second,
 * then a tumble of about a tenth of a second that points it a new way.
 */
export const SWIM = {
  run: 1,
  speed: 25,
  tumble: 0.1,
} as const;

/**
 * How long a run lasts when the cell swims `uphill` toward more sugar or
 * not. A cell that senses the food increasing tumbles later; the lab's model
 * doubles the run up the gradient, which turns a random walk into a drift
 * toward the food.
 */
export function runLength(uphill: boolean, sensing: boolean) {
  return sensing && uphill ? 2 * SWIM.run : SWIM.run;
}

/** The mean turn of a tumble, about 68°, from Berg's "E. coli in Motion". */
export const TUMBLE_TURN = (68 * Math.PI) / 180;

/**
 * One swimming cell in the lab's dish, in micrometres and seconds: where it
 * is, which way it heads, whether it is tumbling, how long the current run or
 * tumble has left, and how many runs it has made, which seeds its next turn.
 */
export const SwimmerSchema = Schema.Struct({
  heading: Schema.Finite,
  left: Schema.Finite,
  runs: Schema.Int,
  tumbling: Schema.Boolean,
  x: Schema.Finite,
  y: Schema.Finite,
});
export type Swimmer = typeof SwimmerSchema.Type;

/**
 * Moves a swimmer on by `dt` seconds in a dish whose sugar increases toward
 * +x. A run carries it straight at 25 µm/s; a tumble holds it in place and
 * turns it by about 68° either way. `unit(runs, salt)` draws the uniform
 * numbers of each new turn, so a run of the lab replays exactly. A `sensing`
 * cell runs twice as long while it heads up the gradient.
 */
export function stepSwimmer(
  swimmer: Swimmer,
  dt: number,
  sensing: boolean,
  unit: (runs: number, salt: number) => number
): Swimmer {
  const left = swimmer.left - dt;
  if (swimmer.tumbling) {
    if (left > 0) {
      return { ...swimmer, left };
    }
    const side = unit(swimmer.runs, 1) < 0.5 ? -1 : 1;
    const heading =
      swimmer.heading + side * TUMBLE_TURN * (0.5 + unit(swimmer.runs, 2));
    return {
      ...swimmer,
      heading,
      left: runLength(Math.cos(heading) > 0, sensing),
      runs: swimmer.runs + 1,
      tumbling: false,
    };
  }
  const moved = Math.min(dt, swimmer.left);
  const x = swimmer.x + Math.cos(swimmer.heading) * SWIM.speed * moved;
  const y = swimmer.y + Math.sin(swimmer.heading) * SWIM.speed * moved;
  if (left > 0) {
    return { ...swimmer, left, x, y };
  }
  return { ...swimmer, left: SWIM.tumble, tumbling: true, x, y };
}

/**
 * Milk's pH before fermentation and the pH at which casein, its main protein,
 * loses its charge and sets into a gel: about 6.7 and 4.6, as Fox and others
 * give in "Dairy Chemistry and Biochemistry" (Springer, 2015).
 */
export const MILK_PH = 6.7;
export const CASEIN_GEL_PH = 4.6;

/**
 * The lab's model of the pH of milk fermenting at 43 °C, `hours` after the
 * starter culture went in: lactic acid builds up slowly, then fast, then
 * slowly again, as a falling S-curve that starts close to milk's pH, passes
 * 4.6 after four hours and settles toward 4.2.
 */
export const GEL_HOURS = 4;
const FINAL_PH = 4.2;
const STEEPNESS = 1.2;
export function phAfter(hours: number) {
  const midpoint =
    GEL_HOURS -
    Math.log((MILK_PH - FINAL_PH) / (CASEIN_GEL_PH - FINAL_PH) - 1) / STEEPNESS;
  return (
    FINAL_PH +
    (MILK_PH - FINAL_PH) / (1 + Math.exp(STEEPNESS * (hours - midpoint)))
  );
}

/** Whether the milk has set into yoghurt: its pH reached casein's. */
export function isSet(hours: number) {
  return phAfter(hours) <= CASEIN_GEL_PH + 1e-9;
}
