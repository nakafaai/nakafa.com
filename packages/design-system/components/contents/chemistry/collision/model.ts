import { Array as Arr, Match, Schema } from "effect";

const SurfacePresetSchema = Schema.Literals(["lump", "granules", "powder"]);

export type SurfacePreset = typeof SurfacePresetSchema.Type;

const CollisionReadingSchema = Schema.Struct({
  collisionFrequency: Schema.Int,
  effectiveFraction: Schema.Finite,
  effectiveRate: Schema.Int,
});

const BoltzmannSampleSchema = Schema.Struct({
  aboveEa: Schema.Boolean,
  density: Schema.Finite,
  energy: Schema.Finite,
});

const EA_THRESHOLD = 0.62;

function surfaceMultiplier(surface: SurfacePreset): number {
  return Match.value(surface).pipe(
    Match.when("lump", () => 1),
    Match.when("granules", () => 1.8),
    Match.when("powder", () => 3),
    Match.exhaustive
  );
}

/** Evaluate collision frequency, fraction exceeding Ea, and effective reaction rate. */
export function evaluateCollision(
  temperatureK: number,
  concentrationM: number,
  surface: SurfacePreset
): typeof CollisionReadingSchema.Type {
  const safeT = Math.max(250, temperatureK);
  const safeC = Math.max(0.1, concentrationM);
  const area = surfaceMultiplier(surface);
  const collisionFrequency = Math.round(
    25 * safeC * area * Math.sqrt(safeT / 300)
  );
  const effectiveFraction = Math.min(
    0.88,
    Math.max(0.05, Math.exp(-900 / safeT) * 2.8)
  );
  const effectiveRate = Math.round(collisionFrequency * effectiveFraction);
  return {
    collisionFrequency,
    effectiveFraction,
    effectiveRate,
  };
}

/** Sample a normalized Maxwell-Boltzmann kinetic energy distribution on [0, 1]. */
export function sampleBoltzmann(
  temperatureK: number,
  steps = 36
): readonly (typeof BoltzmannSampleSchema.Type)[] {
  const safeT = Math.max(250, temperatureK);
  const kT = 0.14 + ((safeT - 250) / 300) * 0.22;
  const count = Math.max(8, Math.round(steps));
  const raw = Arr.makeBy(count + 1, (index) => {
    const energy = index / count;
    const density = (energy / (kT * kT)) * Math.exp(-energy / kT);
    return { aboveEa: energy >= EA_THRESHOLD, density, energy };
  });
  const peak = Arr.reduce(raw, 1e-6, (best, pt) => Math.max(best, pt.density));
  return Arr.map(raw, (pt) => ({
    aboveEa: pt.aboveEa,
    density: pt.density / peak,
    energy: pt.energy,
  }));
}
