/**
 * A geothermal power plant on a loop of hot water. The production well brings
 * 100 kg of reservoir water up every second; the plant draws heat from it
 * until it cools to 70 °C, then the injection well sends it back down. A heat
 * engine between the hot water and 27 °C cooling air can never pass the
 * ideal limit 1 - T_c/T_h, and a real plant reaches about 40% of that limit.
 */

/** The water the production well brings up each second, in kilograms. */
const FLOW = 100;

/** The specific heat capacity of the water, in joules per kilogram kelvin. */
const SPECIFIC_HEAT = 4200;

/** The temperature the water is sent back down at, in degrees Celsius. */
const RETURN_TEMPERATURE = 70;

/** The temperature of the cooling air, in kelvin: 27 °C. */
const COOLING_KELVIN = 300;

/** The share of the ideal limit a real plant reaches. */
const REAL_SHARE = 0.4;

/** The reservoir temperatures the slider offers, in degrees Celsius. */
export const RESERVOIR = { max: 300, min: 120, step: 10 } as const;

/** The heat drawn from the water each second, in watts. */
export function heatRate(reservoir: number) {
  return FLOW * SPECIFIC_HEAT * (reservoir - RETURN_TEMPERATURE);
}

/** The ideal limit of a heat engine between the reservoir and the cooling air. */
export function idealEfficiency(reservoir: number) {
  return 1 - COOLING_KELVIN / (reservoir + 273);
}

/** The share of the heat a real plant turns into electricity. */
export function plantEfficiency(reservoir: number) {
  return REAL_SHARE * idealEfficiency(reservoir);
}

/** The plant's electrical power, in watts. */
export function electricPower(reservoir: number) {
  return heatRate(reservoir) * plantEfficiency(reservoir);
}
