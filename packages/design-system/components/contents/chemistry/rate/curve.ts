import { Schema } from "effect";

/** How finely a solid reactant is divided. */
const SolidSchema = Schema.Literals(["chips", "granules", "powder"]);
export type Solid = typeof SolidSchema.Type;

/**
 * How much faster each form reacts than chips, per unit of time on the
 * lab's unscaled time axis. The values are a model chosen to show the order
 * the surface area sets, not measured rates, so the lab draws no numbers on
 * its time axis.
 */
const SPEED = { chips: 1, granules: 1.8, powder: 3.2 } satisfies Record<
  Solid,
  number
>;

/** The share of the final amount a curve reaches at the end of its time axis. */
export const TIME_SPAN = 4;

/**
 * The amount of gas a run has given off at time `t` on the lab's axis: it
 * rises fastest at the start and levels off at the final amount, as the
 * reactant that runs out first is used up, `final · (1 − e^(−k t))`.
 */
export function amountAt(final: number, solid: Solid, t: number) {
  return final * (1 - Math.exp(-SPEED[solid] * t));
}
