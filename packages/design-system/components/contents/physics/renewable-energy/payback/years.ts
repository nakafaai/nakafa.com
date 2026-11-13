/**
 * The energy payback of a 3 kWp rooftop solar system. Mining, refining,
 * making, shipping and installing the panels uses energy before the first
 * kilowatt-hour comes back; the system then repays that energy at its yearly
 * yield. The 1300 kWh per kWp spent on making it is an illustrative round
 * value in the range life-cycle studies report for silicon panels.
 */

/** The system's peak power, in kilowatts. */
export const SYSTEM_SIZE = 3;

/** The energy spent to make and install each kWp, in kilowatt-hours. */
export const MAKING_ENERGY = 1300;

/** How long the panels work, in years. */
export const LIFETIME = 25;

/** The yearly yields the slider offers, in kilowatt-hours per kWp: cloudy north Europe to the sunniest tropics. */
export const YIELD = { max: 1800, min: 800, step: 100 } as const;

/** The energy the whole system cost to make, in kilowatt-hours. */
export const INVESTED_ENERGY = MAKING_ENERGY * SYSTEM_SIZE;

/** The energy the system gives back each year, in kilowatt-hours. */
export function yearlyEnergy(yieldPerPeak: number) {
  return yieldPerPeak * SYSTEM_SIZE;
}

/** The years until the system has given back the energy it cost. */
export function paybackYears(yieldPerPeak: number) {
  return INVESTED_ENERGY / yearlyEnergy(yieldPerPeak);
}

/** The energy balance after `years`: what came back minus what was spent, in kilowatt-hours. */
export function energyBalance(yieldPerPeak: number, years: number) {
  return (
    yearlyEnergy(yieldPerPeak) * Math.min(Math.max(years, 0), LIFETIME) -
    INVESTED_ENERGY
  );
}

/** How many times over the system repays its energy across its lifetime. */
export function returnRatio(yieldPerPeak: number) {
  return (yearlyEnergy(yieldPerPeak) * LIFETIME) / INVESTED_ENERGY;
}
