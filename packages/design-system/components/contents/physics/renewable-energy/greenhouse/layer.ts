/**
 * The simplest model of the greenhouse effect: Earth's surface under one
 * layer of atmosphere that lets sunlight through but absorbs a share ε of the
 * infrared the surface gives off. The layer radiates what it absorbs, half
 * up to space and half back down, so the surface warms until it sheds the
 * sunlight plus that back radiation. With ε = 0 the surface sits at the bare
 * 255 K; at ε ≈ 0.78 it reaches about 288 K, Earth's average.
 */

/** The sunlight arriving at the top of the atmosphere, in watts per square metre. */
const SOLAR_CONSTANT = 1361;

/** The share of sunlight Earth reflects straight back to space. */
const ALBEDO = 0.3;

/** The Stefan-Boltzmann constant, in watts per square metre per kelvin to the fourth. */
const STEFAN_BOLTZMANN = 5.670_374e-8;

/** The absorptances the slider offers. */
export const ABSORPTANCE = { max: 0.95, min: 0, step: 0.01 } as const;

/** The sunlight the surface absorbs, averaged over the whole globe, in watts per square metre. */
export const ABSORBED_SUNLIGHT = (SOLAR_CONSTANT * (1 - ALBEDO)) / 4;

/** The temperature a bare planet needs to shed that sunlight, in kelvin. */
export const BARE_TEMPERATURE = (ABSORBED_SUNLIGHT / STEFAN_BOLTZMANN) ** 0.25;

/** The infrared the surface gives off when its absorbed and emitted energy balance, in watts per square metre. */
export function surfaceEmission(absorptance: number) {
  return (ABSORBED_SUNLIGHT * 2) / (2 - absorptance);
}

/** The infrared the layer sends back down to the surface, in watts per square metre. */
export function backRadiation(absorptance: number) {
  return (absorptance * surfaceEmission(absorptance)) / 2;
}

/** The surface temperature that balances the sunlight and the back radiation, in kelvin. */
export function surfaceTemperature(absorptance: number) {
  return (surfaceEmission(absorptance) / STEFAN_BOLTZMANN) ** 0.25;
}

/** The infrared that escapes to space: what the layer lets through plus what it sends up, in watts per square metre. */
export function outgoingInfrared(absorptance: number) {
  return (
    (1 - absorptance) * surfaceEmission(absorptance) +
    backRadiation(absorptance)
  );
}
