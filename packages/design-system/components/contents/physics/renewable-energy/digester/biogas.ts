/**
 * A small household biogas digester fed with fresh cattle dung. Microbes break
 * the dung down without oxygen and give off biogas, about 60% methane, which
 * burns in a kitchen stove. The yields are typical round values for a warm
 * climate: 0.04 m³ of biogas from each kilogram of dung, 36 MJ in a cubic
 * metre of methane, and a stove burner using 0.4 m³ of biogas an hour.
 */

/** The biogas each kilogram of fresh dung gives, in cubic metres. */
export const GAS_YIELD = 0.04;

/** The share of the biogas that is methane, the part that burns. */
export const METHANE_SHARE = 0.6;

/** The heat a cubic metre of methane releases when it burns, in joules. */
export const METHANE_ENERGY = 36_000_000;

/** The biogas one stove burner uses each hour, in cubic metres. */
export const BURNER_FLOW = 0.4;

/** The dung the slider offers each day, in kilograms. */
export const DUNG = { max: 60, min: 10, step: 5 } as const;

/** The biogas made each day, in cubic metres. */
export function gasVolume(dung: number) {
  return dung * GAS_YIELD;
}

/** The methane in that biogas, in cubic metres. */
export function methaneVolume(dung: number) {
  return gasVolume(dung) * METHANE_SHARE;
}

/** The chemical energy in the day's methane, in joules. */
export function gasEnergy(dung: number) {
  return methaneVolume(dung) * METHANE_ENERGY;
}

/** How long the day's biogas keeps one burner lit, in hours. */
export function cookingHours(dung: number) {
  return gasVolume(dung) / BURNER_FLOW;
}
