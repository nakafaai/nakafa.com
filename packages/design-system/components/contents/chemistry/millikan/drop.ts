import { Array as Arr } from "effect";

/** The elementary charge in coulombs (exact, SI 2019). */
export const ELEMENTARY_CHARGE = 1.602_176_634e-19;

/**
 * A Millikan drop and its apparatus, in SI units: an oil drop 1 micrometre in
 * radius of oil 886 kg/m3 dense, between plates 5 mm apart, in air of
 * viscosity 1.81e-5 Pa s, with g = 9.81 m/s2.
 */
export const APPARATUS = {
  density: 886,
  gap: 5e-3,
  gravity: 9.81,
  radius: 1e-6,
  viscosity: 1.81e-5,
} as const;

/** The weight of one drop, m g = (4/3) pi r^3 rho g, in newtons. */
export function dropWeight() {
  const { density, gravity, radius } = APPARATUS;
  return (4 / 3) * Math.PI * radius ** 3 * density * gravity;
}

/** The plate voltage that holds a drop carrying `charges` electrons' charge still: q V / d = m g. */
export function hoverVoltage(charges: number) {
  return (dropWeight() * APPARATUS.gap) / (charges * ELEMENTARY_CHARGE);
}

/** The charge a drop must carry to hover at `voltage`, in coulombs: q = m g d / V. */
export function chargeToHover(voltage: number) {
  return (dropWeight() * APPARATUS.gap) / voltage;
}

/**
 * How fast a drop carrying `charges` electrons' charge moves at `voltage`, in
 * metres a second, upward positive: the net force q V / d - m g balanced by
 * the Stokes drag 6 pi eta r v at its steady speed.
 */
export function dropVelocity(charges: number, voltage: number) {
  const { gap, radius, viscosity } = APPARATUS;
  const force = (charges * ELEMENTARY_CHARGE * voltage) / gap - dropWeight();
  return force / (6 * Math.PI * viscosity * radius);
}

/** The charges of the drops in view, in elementary charges. */
export const DROPS = [1, 2, 3, 5] as const;

/** The drop whose hover voltage lies nearest `voltage`, the one the reader is balancing. */
export function nearestDrop(voltage: number) {
  const first: number = DROPS[0];
  return Arr.reduce(DROPS, first, (best, charges) =>
    Math.abs(hoverVoltage(charges) - voltage) <
    Math.abs(hoverVoltage(best) - voltage)
      ? charges
      : best
  );
}
