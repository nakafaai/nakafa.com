/**
 * A hydropower dam. Water falls through the height difference between the
 * reservoir's surface and the turbine, the head, at 10 m³ every second. Each
 * second it gives up ρ g Q h of gravitational potential energy, which arrives
 * at the turbine as kinetic energy, turns the shaft, and leaves the generator
 * as electrical energy. With g = 10 m/s² and an ideal penstock, only the
 * turbine and the generator keep a share back.
 */

/** The gravitational field strength, in newtons per kilogram. */
export const GRAVITY = 10;

/** The density of water, in kilograms per cubic metre. */
export const WATER_DENSITY = 1000;

/** The water flowing through the penstock each second, in cubic metres. */
export const FLOW = 10;

/** The share of the water's energy the turbine passes to its shaft. */
export const TURBINE_EFFICIENCY = 0.9;

/** The share of the shaft's energy the generator turns into electricity. */
export const GENERATOR_EFFICIENCY = 0.95;

/** The heads the dam can hold, in metres. */
export const HEAD = { max: 100, min: 20, step: 10 } as const;

/** The water's gravitational potential energy released each second, in watts. */
export function waterPower(head: number) {
  return WATER_DENSITY * GRAVITY * FLOW * head;
}

/** How fast the water reaches the turbine if none of its energy is lost on the way, in metres per second. */
export function inletSpeed(head: number) {
  return Math.sqrt(2 * GRAVITY * head);
}

/**
 * The power at each stage of the chain, in watts: the water's potential
 * energy, its kinetic energy at the turbine, the turning shaft, and the
 * electricity that leaves the generator.
 */
export function stagePowers(head: number) {
  const potential = waterPower(head);
  const shaft = potential * TURBINE_EFFICIENCY;
  return {
    electric: shaft * GENERATOR_EFFICIENCY,
    kinetic: potential,
    potential,
    shaft,
  };
}
