import { Schema } from "effect";

/**
 * What burning 1 kg of a fossil fuel leaves in the air. Every carbon atom
 * joins two oxygen atoms from the air, C + O₂ → CO₂, so 12 g of carbon
 * becomes 44 g of carbon dioxide: the gas weighs more than the fuel because
 * most of its mass is oxygen taken from the air. The carbon shares and heats
 * are typical values: coal about 70% carbon, diesel 86%, methane exactly 75%.
 */

/** The molar masses of carbon and of carbon dioxide, in grams per mole. */
const CARBON_MOLAR_MASS = 12;
const DIOXIDE_MOLAR_MASS = 44;

/** The volume of a mole of gas at 25 °C and one atmosphere, in cubic metres. */
const MOLAR_VOLUME = 0.0245;

/** The fuel burned, in kilograms. */
export const FUEL_MASS = 1;

/** The three fuels on the burner. */
export const FuelSchema = Schema.Literals(["coal", "diesel", "methane"]);
export type Fuel = typeof FuelSchema.Type;

/** A fuel's share of carbon by mass and the heat a kilogram releases, in joules. */
const FuelEnergySchema = Schema.Struct({
  carbon: Schema.Finite,
  heat: Schema.Finite,
});

/** Each fuel's share of carbon by mass and the heat a kilogram releases, in joules. */
const FUELS = {
  coal: { carbon: 0.7, heat: 24_000_000 },
  diesel: { carbon: 0.86, heat: 43_000_000 },
  methane: { carbon: 0.75, heat: 50_000_000 },
} as const satisfies Record<Fuel, typeof FuelEnergySchema.Type>;

/** The carbon in the burned fuel, in kilograms. */
export function carbonMass(fuel: Fuel) {
  return FUEL_MASS * FUELS[fuel].carbon;
}

/** The carbon dioxide the carbon becomes, in kilograms. */
export function dioxideMass(fuel: Fuel) {
  return (carbonMass(fuel) * DIOXIDE_MOLAR_MASS) / CARBON_MOLAR_MASS;
}

/** The oxygen the carbon takes from the air, in kilograms. */
export function oxygenTaken(fuel: Fuel) {
  return dioxideMass(fuel) - carbonMass(fuel);
}

/** The space the carbon dioxide fills at 25 °C, in cubic metres. */
export function dioxideVolume(fuel: Fuel) {
  return ((dioxideMass(fuel) * 1000) / DIOXIDE_MOLAR_MASS) * MOLAR_VOLUME;
}

/** The carbon dioxide released for each megajoule of heat, in grams. */
export function dioxidePerMegajoule(fuel: Fuel) {
  return (dioxideMass(fuel) * 1000) / (FUELS[fuel].heat / 1_000_000);
}
