import { Array as Arr, Schema } from "effect";

/** The elements a mass spectrometer lab can analyse. */
export const SampleIdSchema = Schema.Literals([
  "boron",
  "carbon",
  "neon",
  "magnesium",
  "chlorine",
  "copper",
]);
export type SampleId = typeof SampleIdSchema.Type;

const IsotopeSchema = Schema.Struct({
  /** The share of the element's atoms, from 0 to 1. */
  abundance: Schema.Finite,
  /** The isotope's mass in unified atomic mass units. */
  mass: Schema.Finite,
  /** The mass number, protons plus neutrons. */
  number: Schema.Int,
});

const SampleSchema = Schema.Struct({
  isotopes: Schema.Array(IsotopeSchema),
  symbol: Schema.String,
});

/**
 * Isotope masses (AME 2020) and representative isotopic compositions of the
 * stable isotopes (IUPAC CIAAW, as tabulated by NIST).
 */
const SAMPLES = {
  boron: {
    isotopes: [
      { abundance: 0.199, mass: 10.012_937, number: 10 },
      { abundance: 0.801, mass: 11.009_305, number: 11 },
    ],
    symbol: "B",
  },
  carbon: {
    isotopes: [
      { abundance: 0.9893, mass: 12, number: 12 },
      { abundance: 0.0107, mass: 13.003_355, number: 13 },
    ],
    symbol: "C",
  },
  chlorine: {
    isotopes: [
      { abundance: 0.7576, mass: 34.968_853, number: 35 },
      { abundance: 0.2424, mass: 36.965_903, number: 37 },
    ],
    symbol: "Cl",
  },
  copper: {
    isotopes: [
      { abundance: 0.6915, mass: 62.929_598, number: 63 },
      { abundance: 0.3085, mass: 64.927_79, number: 65 },
    ],
    symbol: "Cu",
  },
  magnesium: {
    isotopes: [
      { abundance: 0.7899, mass: 23.985_042, number: 24 },
      { abundance: 0.1, mass: 24.985_837, number: 25 },
      { abundance: 0.1101, mass: 25.982_593, number: 26 },
    ],
    symbol: "Mg",
  },
  neon: {
    isotopes: [
      { abundance: 0.9048, mass: 19.992_44, number: 20 },
      { abundance: 0.0027, mass: 20.993_847, number: 21 },
      { abundance: 0.0925, mass: 21.991_385, number: 22 },
    ],
    symbol: "Ne",
  },
} as const satisfies Record<SampleId, typeof SampleSchema.Type>;

/** The symbol and isotopes of one sample. */
export function getSample(id: SampleId): typeof SampleSchema.Type {
  return SAMPLES[id];
}

/** The average atomic mass, each isotope's mass weighted by its share. */
export function averageMass(id: SampleId) {
  return Arr.reduce(
    getSample(id).isotopes,
    0,
    (total, isotope) => total + isotope.mass * isotope.abundance
  );
}

/**
 * The radius an ion of `mass` turns on in the magnet, relative to an ion of
 * `reference` mass: ions of one charge, sped up by one voltage, turn on
 * r = sqrt(2 m V / q) / B, so the radius grows as the square root of the mass.
 */
export function pathRadius(mass: number, reference: number) {
  return Math.sqrt(mass / reference);
}
