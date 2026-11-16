/**
 * A microhydro plant on a hillside stream. Part of the stream is led into a
 * pipe that drops through the head to a turbine, and the usable power is
 * P ≈ ρ g Q h η. Every home in the hamlet needs 250 W for its evening lights,
 * phone charging and a small appliance, so the power sets how many homes can
 * be lit. With g = 10 m/s² and η = 0.7, 20 L/s through 10 m gives 1400 W.
 */

/** The density of water, in kilograms per cubic metre. */
const WATER_DENSITY = 1000;

/** The gravitational field strength, in newtons per kilogram. */
const GRAVITY = 10;

/** The share of the water's power the turbine and generator deliver. */
const EFFICIENCY = 0.7;

/** The evening power one home needs, in watts. */
const HOME_POWER = 250;

/** The homes the hamlet has. */
export const HOMES = 16;

/** The flows the slider offers, in litres per second. */
export const FLOW = { max: 30, min: 5, step: 5 } as const;

/** The heads the slider offers, in metres. */
export const HEAD = { max: 20, min: 5, step: 5 } as const;

/** The usable power from `flow` litres per second dropping `head` metres, in watts. */
export function plantPower(flow: number, head: number) {
  return WATER_DENSITY * GRAVITY * (flow / 1000) * head * EFFICIENCY;
}

/** How many of the hamlet's homes that power can light. */
export function homesLit(flow: number, head: number) {
  return Math.min(Math.floor(plantPower(flow, head) / HOME_POWER), HOMES);
}
