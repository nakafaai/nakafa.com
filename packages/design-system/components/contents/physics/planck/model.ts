import { Array as Arr, Schema } from "effect";

const RadiationModelSchema = Schema.Literals(["planck", "classical"]);

export type RadiationModel = typeof RadiationModelSchema.Type;

const BlackbodyReadingSchema = Schema.Struct({
  peakPhotonEv: Schema.Finite,
  peakWavelengthNm: Schema.Finite,
  temperatureK: Schema.Finite,
});

const SpectrumPointSchema = Schema.Struct({
  classical: Schema.Finite,
  planck: Schema.Finite,
  wavelengthNm: Schema.Finite,
});

const WIEN_NM_K = 2_897_772;
const HC_EV_NM = 1239.84;

/** Evaluate Wien peak wavelength (nm) and peak photon energy (eV) at temperature T (K). */
export function evaluateBlackbody(
  temperatureK: number
): typeof BlackbodyReadingSchema.Type {
  const safeT = Math.max(500, temperatureK);
  const peakWavelengthNm = WIEN_NM_K / safeT;
  const peakPhotonEv = HC_EV_NM / peakWavelengthNm;
  return {
    peakPhotonEv,
    peakWavelengthNm,
    temperatureK: safeT,
  };
}

/** Sample normalized Planck and Rayleigh-Jeans spectral radiance from 200 nm to 2000 nm. */
export function sampleBlackbodySpectrum(
  temperatureK: number,
  steps = 36
): readonly (typeof SpectrumPointSchema.Type)[] {
  const safeT = Math.max(500, temperatureK);
  const count = Math.max(8, Math.round(steps));
  const c2 = 1.4388e7; // hc/kB in nm*K
  const raw = Arr.makeBy(count + 1, (index) => {
    const wavelengthNm = 200 + (index / count) * 1800;
    const x = c2 / (wavelengthNm * safeT);
    const planckRaw = x > 60 ? 0 : 1 / (wavelengthNm ** 5 * (Math.exp(x) - 1));
    const classicalRaw = safeT / (wavelengthNm ** 4 * c2);
    return { classicalRaw, planckRaw, wavelengthNm };
  });
  const maxPlanck = Arr.reduce(raw, 1e-30, (best, pt) =>
    Math.max(best, pt.planckRaw)
  );
  return Arr.map(raw, (pt) => ({
    classical: Math.min(1.6, pt.classicalRaw / maxPlanck),
    planck: pt.planckRaw / maxPlanck,
    wavelengthNm: pt.wavelengthNm,
  }));
}
