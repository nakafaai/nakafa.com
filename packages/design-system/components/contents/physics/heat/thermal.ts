/**
 * Heat and gases for the thermal labs. Warming a mass m by Δθ takes m c Δθ,
 * and melting it at its melting point takes m L, with no change of
 * temperature. In an insulated mixture the heat one part gives out equals
 * the heat the other takes in. A fixed mass of gas keeps p V / T constant,
 * with T in kelvin.
 */

/** The offset from degrees Celsius to kelvin. */
export const KELVIN = 273;

/**
 * Ice at its melting point dropped into warm water in an insulated
 * container. If the water can melt all the ice while cooling to the melting
 * point, the leftover heat warms all the water together; otherwise some ice
 * stays and the mixture settles at the melting point. Masses in kilograms,
 * temperatures in degrees Celsius, heats in joules.
 */
export function meltIce(mixture: {
  readonly ice: number;
  readonly latent: number;
  readonly specific: number;
  readonly temperature: number;
  readonly water: number;
}) {
  const melt = mixture.ice * mixture.latent;
  const given = mixture.water * mixture.specific * mixture.temperature;
  if (given < melt) {
    return { final: 0, given, melt, melted: given / mixture.latent };
  }
  const total = mixture.ice + mixture.water;
  return {
    final: (given - melt) / (total * mixture.specific),
    given,
    melt,
    melted: mixture.ice,
  };
}

/** The pressure of a fixed mass of gas after its volume is scaled by `volume` and its temperature changes from `from` to `to` degrees Celsius. */
export function gasPressure(
  pressure: number,
  volume: number,
  temperatures: { readonly from: number; readonly to: number }
) {
  return (
    (pressure / volume) *
    ((temperatures.to + KELVIN) / (temperatures.from + KELVIN))
  );
}

/**
 * A constant heater warms the liquid by `rise` degrees in `warm` seconds,
 * which gives its power, and the same power melts the solid in `melt`
 * seconds, which gives the specific latent heat of fusion. Mass in
 * kilograms, specific heat capacity in J kg⁻¹ °C⁻¹.
 */
export function latentFromHeating(sample: {
  readonly mass: number;
  readonly melt: number;
  readonly rise: number;
  readonly specific: number;
  readonly warm: number;
}) {
  const power = (sample.mass * sample.specific * sample.rise) / sample.warm;
  return { latent: (power * sample.melt) / sample.mass, power };
}

/**
 * The temperature a `share` of the way through a heating that first melts a
 * solid for `melt` minutes at its melting point and then warms the liquid to
 * `top` over `warm` minutes: flat while it melts, then a steady climb.
 */
export function heatingTemperature(
  heating: {
    readonly melt: number;
    readonly melting: number;
    readonly top: number;
    readonly warm: number;
  },
  share: number
) {
  const minutes = share * (heating.melt + heating.warm);
  if (minutes <= heating.melt) {
    return heating.melting;
  }
  return (
    heating.melting +
    ((heating.top - heating.melting) * (minutes - heating.melt)) / heating.warm
  );
}
