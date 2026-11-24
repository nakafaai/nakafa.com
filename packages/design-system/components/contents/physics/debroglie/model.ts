import { Match, Schema } from "effect";

const QuantumParticleSchema = Schema.Literals([
  "electron",
  "proton",
  "neutron",
  "alpha",
]);

export type QuantumParticle = typeof QuantumParticleSchema.Type;

const DeBroglieReadingSchema = Schema.Struct({
  diffractionRadius: Schema.Finite,
  momentumUnits: Schema.Finite,
  wavelengthPm: Schema.Finite,
});

const PLANCK_H = 6.626e-34;
const ELEMENTARY_Q = 1.602e-19;

function particleProps(particle: QuantumParticle) {
  return Match.value(particle).pipe(
    Match.when("electron", () => ({ chargeMult: 1, massKg: 9.109e-31 })),
    Match.when("proton", () => ({ chargeMult: 1, massKg: 1.673e-27 })),
    Match.when("neutron", () => ({ chargeMult: 1, massKg: 1.675e-27 })),
    Match.when("alpha", () => ({ chargeMult: 2, massKg: 6.644e-27 })),
    Match.exhaustive
  );
}

/**
 * Evaluate de Broglie wavelength (pm), scaled momentum, and relative diffraction
 * ring radius for a particle accelerated through voltage V (volts).
 */
export function evaluateDeBroglie(
  particle: QuantumParticle,
  voltageV: number
): typeof DeBroglieReadingSchema.Type {
  const safeV = Math.max(1, voltageV);
  const { chargeMult, massKg } = particleProps(particle);
  const kineticJ = chargeMult * ELEMENTARY_Q * safeV;
  const momentum = Math.sqrt(2 * massKg * kineticJ);
  const wavelengthM = PLANCK_H / momentum;
  const wavelengthPm = wavelengthM * 1e12;
  const momentumUnits = momentum * 1e24;
  const diffractionRadius = Math.min(1, Math.max(0.18, wavelengthPm / 80));

  return {
    diffractionRadius,
    momentumUnits,
    wavelengthPm,
  };
}
