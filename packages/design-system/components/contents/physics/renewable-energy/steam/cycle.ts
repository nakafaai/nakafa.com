import { Schema } from "effect";

/**
 * A steam power plant that takes in 1000 MW of heat. Burning coal or gas, or
 * splitting uranium, only makes the heat; from the boiler on, every plant is
 * the same steam cycle, and the condenser at 30 °C takes the heat the turbine
 * cannot use. Hotter steam raises the ideal limit 1 - T_c/T_h. The steam
 * temperatures, efficiencies and fuel energies are typical round values; the
 * uranium figure is enriched reactor fuel at a burnup of 45 GWd per tonne.
 */

/** The heat the plant takes in, in watts. */
export const HEAT_INPUT = 1_000_000_000;

/** The condenser's temperature, in kelvin: 30 °C. */
const CONDENSER_KELVIN = 303;

/** The three fuels that can heat the boiler. */
export const FuelSchema = Schema.Literals(["coal", "gas", "uranium"]);
export type Fuel = typeof FuelSchema.Type;

/** A fuel's plant efficiency, the heat a kilogram releases in joules, and its steam temperature in degrees Celsius. */
const FuelPlantSchema = Schema.Struct({
  efficiency: Schema.Finite,
  perKilogram: Schema.Finite,
  steam: Schema.Finite,
});

/** Each fuel's steam temperature in degrees Celsius, the plant's efficiency, and the heat a kilogram releases in joules. */
export const FUELS = {
  coal: { efficiency: 0.38, perKilogram: 24_000_000, steam: 540 },
  gas: { efficiency: 0.38, perKilogram: 50_000_000, steam: 540 },
  uranium: { efficiency: 0.33, perKilogram: 3_888_000_000_000, steam: 285 },
} as const satisfies Record<Fuel, typeof FuelPlantSchema.Type>;

/** The ideal limit of a heat engine between the steam and the condenser. */
export function idealEfficiency(fuel: Fuel) {
  return 1 - CONDENSER_KELVIN / (FUELS[fuel].steam + 273);
}

/** The electricity the plant sends out, in watts. */
export function electricOutput(fuel: Fuel) {
  return HEAT_INPUT * FUELS[fuel].efficiency;
}

/** The heat the condenser hands to the cooling water and the air, in watts. */
export function wasteHeat(fuel: Fuel) {
  return HEAT_INPUT - electricOutput(fuel);
}

/** The fuel the plant uses each hour, in kilograms. */
export function fuelPerHour(fuel: Fuel) {
  return (HEAT_INPUT * 3600) / FUELS[fuel].perKilogram;
}
