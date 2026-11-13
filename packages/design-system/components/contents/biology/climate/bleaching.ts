import { Schema } from "effect";

/**
 * Coral heat stress as NOAA Coral Reef Watch measures it (Liu et al., Remote
 * Sensing 6, 2014; Skirving et al., Remote Sensing 12, 2020). A HotSpot is
 * how far the water is above the warmest month's average, the maximum
 * monthly mean (MMM); only a HotSpot of 1 °C or more stresses corals, and
 * Degree Heating Weeks (DHW) add those HotSpots up over 12 weeks.
 */
export const WINDOW_WEEKS = 12;

/** The warmest month's average on a reef like those around Indonesia, in °C. */
export const REEF_MMM = 29;

/** How warm the water is over the warmest month's average, in °C. */
export function hotspotOf(temperature: number, mmm: number) {
  return Math.max(0, temperature - mmm);
}

/**
 * The Degree Heating Weeks after `weeks` of water at `temperature`: each
 * week adds its HotSpot once it reaches 1 °C, and only the last 12 weeks
 * count.
 */
export function heatingWeeksOf(temperature: number, weeks: number, mmm: number) {
  const hotspot = hotspotOf(temperature, mmm);
  if (hotspot < 1) {
    return 0;
  }
  return hotspot * Math.min(WINDOW_WEEKS, Math.max(0, weeks));
}

/** The alert levels Coral Reef Watch names for a reef. */
export const AlertSchema = Schema.Literals([
  "calm",
  "watch",
  "warning",
  "bleaching",
  "dying",
]);
export type Alert = typeof AlertSchema.Type;

/**
 * The alert for a reef: calm below the warmest month, a watch above it, a
 * warning once stress builds, significant bleaching likely from 4 °C-weeks
 * (Alert Level 1) and severe bleaching with deaths likely from 8 °C-weeks
 * (Alert Level 2).
 */
export function alertOf(hotspot: number, dhw: number): Alert {
  if (dhw >= 8) {
    return "dying";
  }
  if (dhw >= 4) {
    return "bleaching";
  }
  if (dhw > 0) {
    return "warning";
  }
  return hotspot > 0 ? "watch" : "calm";
}

/**
 * How pale the coral looks, from 0 (full colour) to 1 (white): corals start
 * losing their algae as stress builds and are fully pale by 8 °C-weeks.
 */
export function palenessOf(dhw: number) {
  return Math.min(1, Math.max(0, (dhw - 1) / 7));
}
