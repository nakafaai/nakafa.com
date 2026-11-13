import { Schema } from "effect";

/**
 * An electric kettle with a 2100 W element heats water from 25 °C to its
 * boiling point. Electrical work crosses into the kettle, and the water stores
 * it as internal energy, Q = m c ΔT. The model keeps every joule in the water,
 * so it shows the least time any kettle of this power can need.
 */

/** The specific heat capacity of liquid water, in joules per kilogram kelvin. */
export const SPECIFIC_HEAT = 4200;

/** The element's electrical power, in watts. */
export const ELEMENT_POWER = 2100;

/** The water's starting temperature, in degrees Celsius. */
export const START_TEMPERATURE = 25;

/** The temperature at which the water boils at sea level, in degrees Celsius. */
export const BOILING_POINT = 100;

/** The temperature rise to the boil, in kelvin. */
export const TEMPERATURE_RISE = BOILING_POINT - START_TEMPERATURE;

/** How much water the kettle holds. */
export const FillSchema = Schema.Literals(["half", "full", "brim"]);
export type Fill = typeof FillSchema.Type;

/** The water's mass for each fill, in kilograms. */
export const FILL_MASS = {
  brim: 1.5,
  full: 1,
  half: 0.5,
} as const satisfies Record<Fill, number>;

/** The energy the water must take in to reach the boil, in joules. */
export function heatNeeded(fill: Fill) {
  return FILL_MASS[fill] * SPECIFIC_HEAT * TEMPERATURE_RISE;
}

/** The time the element needs to deliver that energy, in seconds. */
export function boilTime(fill: Fill) {
  return heatNeeded(fill) / ELEMENT_POWER;
}

/** The water's temperature after `seconds` of heating, in degrees Celsius, held at the boil. */
export function waterTemperature(fill: Fill, seconds: number) {
  const delivered = ELEMENT_POWER * Math.max(seconds, 0);
  const rise = delivered / (FILL_MASS[fill] * SPECIFIC_HEAT);
  return Math.min(START_TEMPERATURE + rise, BOILING_POINT);
}
