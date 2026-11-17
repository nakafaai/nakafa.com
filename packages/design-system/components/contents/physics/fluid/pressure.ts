/**
 * Pressure in fluids for the fluid labs. Pascal's principle carries a
 * pressure unchanged through a closed liquid, so a small force on a small
 * piston becomes a large force on a large one, while the incompressible
 * liquid moves the same volume at both. A floating body displaces its own
 * weight of liquid. In a steady flow the volume per second is the same
 * everywhere, so a narrower section runs faster, and by Bernoulli's
 * principle faster water has lower pressure. A liquid column h deep presses
 * with h ρ g, so columns of equal pressure stand inversely to their
 * densities.
 */

/** The gravitational field strength the SPM papers use, in N kg⁻¹. */
const GRAVITY = 10;

/** A hydraulic jack: the force and rise at the large piston and the pressure in the liquid. Areas in m², force in N, stroke in any length unit. */
export function hydraulicJack(jack: {
  readonly force: number;
  readonly large: number;
  readonly small: number;
  readonly stroke: number;
}) {
  const pressure = jack.force / jack.small;
  const lifted = pressure * jack.large;
  return {
    lifted,
    mass: lifted / GRAVITY,
    pressure,
    rise: (jack.stroke * jack.small) / jack.large,
  };
}

/**
 * A block of `volume` that floats in water with `underWater` of it below the
 * surface, moved into a liquid of `density` (water is 1). Its mass stays the
 * same, so it sinks until it displaces that mass of the new liquid, or to
 * the bottom if even all of it cannot.
 */
export function floatIn(volume: number, underWater: number, density: number) {
  const under = Math.min(underWater / density, volume);
  return {
    above: volume - under,
    floats: underWater / density < volume,
    under,
  };
}

/**
 * Water flowing from a section of diameter `wide` at `speed` into a
 * section of diameter `narrow`: its speed there and how much lower the open
 * tube above the narrow section stands, in metres. Diameters in any unit,
 * speed in m s⁻¹.
 */
export function venturi(wide: number, narrow: number, speed: number) {
  const faster = speed * (wide / narrow) ** 2;
  return { drop: (faster ** 2 - speed ** 2) / (2 * GRAVITY), faster };
}

/** A gas pressing on a manometer `height` cm higher than the open side: the gas pressure in cm of the reference liquid, from the densities of the manometer and reference liquids. */
export function manometer(
  height: number,
  densities: { readonly liquid: number; readonly reference: number },
  atmosphere: number
) {
  const excess = (height * densities.liquid) / densities.reference;
  return { excess, gas: atmosphere + excess };
}
