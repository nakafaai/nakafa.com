/**
 * A 1.6 m² solar panel turned toward the sun on a stand. Clear-sky sunlight
 * brings about 1000 W to every square metre held square to its rays. A
 * surface tilted away from that catches only the cosine of the angle between
 * the rays and its normal, because the same rays spread over more area. On a
 * flat panel that angle is 90° minus the sun's height, so it collects
 * 1000 sin α watts per square metre.
 */

/** The sunlight on a square metre square to the rays, in watts per square metre. */
export const BEAM = 1000;

/** The panel's area, in square metres. */
export const PANEL_AREA = 1.6;

/** The share of sunlight the panel turns into electricity. */
export const PANEL_EFFICIENCY = 0.2;

/** The sun heights the slider offers, in degrees above the horizon. */
export const SUN_HEIGHT = { max: 90, min: 10, step: 5 } as const;

/** The tilts the stand can hold, in degrees from flat, facing the sun. */
export const TILT = { max: 60, min: 0, step: 5 } as const;

/** The angle between the rays and the panel's normal, in degrees. */
export function incidenceAngle(sun: number, tilt: number) {
  return Math.abs(90 - sun - tilt);
}

/** The sunlight the panel catches on each square metre, in watts per square metre. */
export function panelIrradiance(sun: number, tilt: number) {
  return Math.max(
    BEAM * Math.cos((incidenceAngle(sun, tilt) * Math.PI) / 180),
    0
  );
}

/** The panel's electrical power, in watts. */
export function panelPower(sun: number, tilt: number) {
  return panelIrradiance(sun, tilt) * PANEL_AREA * PANEL_EFFICIENCY;
}
