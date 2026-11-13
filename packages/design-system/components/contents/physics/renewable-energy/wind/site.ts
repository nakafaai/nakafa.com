import { Schema } from "effect";

/**
 * One wind turbine with a 40 m rotor, set at three sites. The wind carries
 * ½ ρ A v³ watts through the rotor's disc, because faster air brings more
 * kilograms each second and each kilogram more energy. The rotor converts
 * 40% of it, below the 59.3% Betz limit, and its tips run at seven times the
 * wind speed. The site wind speeds are illustrative steady averages.
 */

/** The density of air near sea level, in kilograms per cubic metre. */
const AIR_DENSITY = 1.225;

/** The rotor's radius, in metres. */
export const ROTOR_RADIUS = 40;

/** The share of the wind's power the turbine turns into electricity. */
const POWER_SHARE = 0.4;

/** How many times faster than the wind the blade tips move. */
const TIP_SPEED_RATIO = 7;

/** The three sites the turbine can stand at. */
export const SiteSchema = Schema.Literals(["valley", "hill", "coast"]);
export type Site = typeof SiteSchema.Type;

/** Each site's average wind speed, in metres per second. */
export const SITE_WIND = {
  coast: 8,
  hill: 6,
  valley: 4,
} as const satisfies Record<Site, number>;

/** The area the rotor sweeps, in square metres. */
const ROTOR_AREA = Math.PI * ROTOR_RADIUS * ROTOR_RADIUS;

/** The power the wind carries through the rotor's disc, in watts. */
export function windPower(site: Site) {
  return 0.5 * AIR_DENSITY * ROTOR_AREA * SITE_WIND[site] ** 3;
}

/** The turbine's electrical power, in watts. */
export function turbinePower(site: Site) {
  return windPower(site) * POWER_SHARE;
}

/** The energy a day of that wind gives, in kilowatt-hours. */
export function dailyEnergy(site: Site) {
  return (turbinePower(site) * 24) / 1000;
}

/** How fast the rotor turns, in radians per second. */
export function rotorSpeed(site: Site) {
  return (TIP_SPEED_RATIO * SITE_WIND[site]) / ROTOR_RADIUS;
}
