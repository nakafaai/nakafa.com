import { Schema } from "effect";

/**
 * A flashlight on two AA cells, 3 V and 2.5 Ah. The cells' chemical energy
 * becomes electrical energy that the bulb draws at 1 W, and the bulb turns
 * that into light and heat. A filament bulb gives about 5% of it as light, an
 * LED about 40%: the battery lasts just as long, but the LED shines brighter.
 * The shares are typical round values, not one product's measurement.
 */

/** The voltage of two AA cells in series, in volts. */
const BATTERY_VOLTAGE = 3;

/** The charge the cells deliver before they are flat, in ampere hours. */
const BATTERY_CHARGE = 2.5;

/** The chemical energy the cells hand over as electrical energy, in joules. */
export const BATTERY_ENERGY = BATTERY_VOLTAGE * BATTERY_CHARGE * 3600;

/** The electrical power the bulb draws, in watts. */
export const INPUT_POWER = 1;

/** The two bulbs the flashlight can hold. */
export const BulbSchema = Schema.Literals(["filament", "led"]);
export type Bulb = typeof BulbSchema.Type;

/** The share of the electrical power each bulb gives out as light. */
export const LIGHT_SHARE = {
  filament: 0.05,
  led: 0.4,
} as const satisfies Record<Bulb, number>;

/** The power that leaves the bulb as light, in watts. */
export function lightPower(bulb: Bulb) {
  return INPUT_POWER * LIGHT_SHARE[bulb];
}

/** The power that leaves the bulb as heat, in watts. */
export function heatPower(bulb: Bulb) {
  return INPUT_POWER - lightPower(bulb);
}

/** How long the cells keep the bulb lit, in seconds. */
export const RUN_TIME = BATTERY_ENERGY / INPUT_POWER;

/** The light the whole battery gives, in joules. */
export function lightEnergy(bulb: Bulb) {
  return BATTERY_ENERGY * LIGHT_SHARE[bulb];
}
