/**
 * Gravitation for the gravity labs. For circular orbits round one body,
 * Kepler's third law gives T² ∝ r³, with r measured from the body's centre.
 * At a planet's surface, gravity g = G M / R², the escape velocity is
 * √(2 G M / R), and a satellite skimming the surface moves at √(G M / R)
 * with period 2π √(R³ / G M), so each scales with its own power of the mass
 * and the radius.
 */

/** The period of an orbit `radius` from the centre, given another orbit's radius and period in the same units. */
export function keplerPeriod(
  known: { readonly period: number; readonly radius: number },
  radius: number
) {
  return known.period * (radius / known.radius) ** 1.5;
}

/** How a planet of `mass` and `radius` times the Earth's compares with the Earth, quantity by quantity. */
export function planetRatios(mass: number, radius: number) {
  return {
    escape: Math.sqrt(mass / radius),
    gravity: mass / radius ** 2,
    orbit: Math.sqrt(mass / radius),
    period: Math.sqrt(radius ** 3 / mass),
  };
}
