import { Array as Arr } from "effect";

/**
 * Nuclear and quantum physics for the modern-physics labs. A sample's
 * activity halves every half-life, while the background a counter also
 * records stays put, so the background comes off every reading first. The
 * mass of the products of a fission is a little less than the mass that went
 * in, and that mass defect leaves as energy, E = Δm c². A photon carries
 * E = h c / λ, and it frees an electron from a metal only if that one
 * photon's energy exceeds the work function; the rest becomes the electron's
 * greatest kinetic energy.
 */

/** The half-life from two counter readings `time` apart that both include the same background, in the unit of `time`. */
export function halfLifeFromReadings(
  readings: { readonly first: number; readonly later: number },
  background: number,
  time: number
) {
  const start = readings.first - background;
  const end = readings.later - background;
  return { end, halfLife: time / Math.log2(start / end), start };
}

/** The count rate a counter records at `time`, from the sample's starting rate, its half-life and the background. */
export function recordedRate(
  sample: { readonly halfLife: number; readonly start: number },
  background: number,
  time: number
) {
  return sample.start * 2 ** (-time / sample.halfLife) + background;
}

/**
 * A fission: the mass before (the nucleus and the neutron it absorbs) and
 * after (the two fragments and the neutrons released), the mass defect in
 * atomic mass units and kilograms, and the energy released in joules.
 */
export function fissionEnergy(
  reaction: {
    readonly after: readonly number[];
    readonly before: readonly number[];
  },
  units: { readonly atomic: number; readonly light: number }
) {
  const total = (masses: readonly number[]) =>
    Arr.reduce(masses, 0, (sum, mass) => sum + mass);
  const before = total(reaction.before);
  const after = total(reaction.after);
  const defect = before - after;
  const kilograms = defect * units.atomic;
  return {
    after,
    before,
    defect,
    energy: kilograms * units.light ** 2,
    kilograms,
  };
}

/** One photon of wavelength `wavelength` nm on a metal of work function `work` eV: its energy and the electron's greatest kinetic energy, in eV, or none freed. */
export function photoelectric(
  wavelength: number,
  work: number,
  constants: {
    readonly charge: number;
    readonly light: number;
    readonly planck: number;
  }
) {
  const energy =
    (constants.planck * constants.light) /
    (wavelength * 1e-9) /
    constants.charge;
  const spare = energy - work;
  return { emits: spare > 0, energy, kinetic: Math.max(spare, 0) };
}
