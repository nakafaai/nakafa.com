import { Schema } from "effect";

/**
 * Satellites in circular orbits around the Earth. Gravity is the only force
 * on them and it always points to the Earth's centre, so it supplies exactly
 * the centripetal acceleration their uniform circular motion needs: v² / r
 * equals GM / r². Constants: the Earth's GM, 3.986004418 × 10¹⁴ m³/s²
 * (IERS Conventions 2010), and its mean radius, 6,371 km (IUGG).
 */

/** The Earth's gravitational parameter, in m³/s². */
export const EARTH_GM = 3.986_004_418e14;

/** The Earth's mean radius, in metres. */
export const EARTH_RADIUS = 6.371e6;

/**
 * The orbits a learner can pick, by their height above the ground in
 * metres: the International Space Station (about 400 km), a GPS satellite
 * (20,200 km), and a geostationary satellite (35,786 km), which turns once
 * a sidereal day and so hangs over one spot of the equator.
 */
export const OrbitSchema = Schema.Literals(["station", "gps", "geostationary"]);
export type Orbit = typeof OrbitSchema.Type;
export const ORBIT_HEIGHTS = {
  geostationary: 3.5786e7,
  gps: 2.02e7,
  station: 4e5,
} as const satisfies Record<Orbit, number>;

/** The radius, speed, period, and centripetal acceleration of an orbit. */
export function orbitMotion(orbit: Orbit) {
  const radius = EARTH_RADIUS + ORBIT_HEIGHTS[orbit];
  const speed = Math.sqrt(EARTH_GM / radius);
  return {
    acceleration: (speed * speed) / radius,
    period: (2 * Math.PI * radius) / speed,
    radius,
    speed,
  };
}
