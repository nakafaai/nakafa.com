import { Array as Arr, Schema } from "effect";

const INSECTS = ["grasshopper", "butterfly"] as const;
const STAGES = ["egg", "nymph", "larva", "pupa", "adult"] as const;

const InsectSchema = Schema.Literals(INSECTS);
const StageSchema = Schema.Literals(STAGES);

export type Insect = typeof InsectSchema.Type;
export type Stage = typeof StageSchema.Type;

const GrowthSnapshotSchema = Schema.Struct({
  instar: Schema.Finite,
  lengthMm: Schema.Finite,
  massMg: Schema.Finite,
  moults: Schema.Finite,
  shedding: Schema.Boolean,
  stage: StageSchema,
});

type GrowthSnapshot = typeof GrowthSnapshotSchema.Type;

const NYMPH_BASE_MM = 11;
const NYMPH_STEP_MM = 6.5;
const LARVA_BASE_MM = 6;
const LARVA_STEP_MM = 9.5;

/** Clamp normalized life-cycle time into [0, 1]. */
export function clampTime(time: number): number {
  return Math.max(0, Math.min(1, time));
}

/**
 * Insect life-cycle state at normalized `time` (0..1):
 * - Grasshopper (incomplete metamorphosis): egg -> 5 nymph instars with
 *   staircase length jumps at each ecdysis moult -> winged adult; continuous
 *   mass growth across intermoult feeding.
 * - Butterfly (complete metamorphosis): egg -> 5 caterpillar larval instars ->
 *   pupa (chrysalis) -> adult butterfly.
 */
export function growthAt(insect: Insect, time: number): GrowthSnapshot {
  const t = clampTime(time);

  if (insect === "grasshopper") {
    const massMg = Math.round(8 + t * t * 920);
    if (t < 0.08) {
      return {
        instar: 0,
        lengthMm: 5,
        massMg,
        moults: 0,
        shedding: false,
        stage: "egg",
      };
    }
    if (t >= 0.86) {
      return {
        instar: 5,
        lengthMm: 42,
        massMg,
        moults: 5,
        shedding: t < 0.9,
        stage: "adult",
      };
    }
    const nymphProgress = (t - 0.08) / (0.86 - 0.08);
    const scaled = nymphProgress * 5;
    const instarIndex = Math.min(4, Math.floor(scaled));
    const frac = scaled - instarIndex;
    return {
      instar: instarIndex + 1,
      lengthMm: Math.round(NYMPH_BASE_MM + instarIndex * NYMPH_STEP_MM),
      massMg,
      moults: instarIndex,
      shedding: instarIndex > 0 && frac < 0.16,
      stage: "nymph",
    };
  }

  const massMg = Math.round(
    t < 0.72 ? 4 + (t / 0.72) ** 1.8 * 680 : 684 - ((t - 0.72) / 0.28) * 140
  );
  if (t < 0.08) {
    return {
      instar: 0,
      lengthMm: 2,
      massMg,
      moults: 0,
      shedding: false,
      stage: "egg",
    };
  }
  if (t < 0.72) {
    const larvaProgress = (t - 0.08) / (0.72 - 0.08);
    const scaled = larvaProgress * 4;
    const instarIndex = Math.min(3, Math.floor(scaled));
    const frac = scaled - instarIndex;
    return {
      instar: instarIndex + 1,
      lengthMm: Math.round(LARVA_BASE_MM + instarIndex * LARVA_STEP_MM),
      massMg,
      moults: instarIndex,
      shedding: instarIndex > 0 && frac < 0.18,
      stage: "larva",
    };
  }
  if (t < 0.88) {
    return {
      instar: 4,
      lengthMm: 28,
      massMg,
      moults: 4,
      shedding: t < 0.76,
      stage: "pupa",
    };
  }
  return {
    instar: 4,
    lengthMm: 32,
    massMg,
    moults: 5,
    shedding: t < 0.92,
    stage: "adult",
  };
}

/** How many samples the growth record is drawn through. */
const RECORD_SAMPLES = 101;

/**
 * The body length and the body mass through the whole life cycle, one row per
 * percent of it: `x` is the time in percent, `length` the length in
 * millimetres and `mass` the mass in milligrams. The length rises in steps,
 * one at every moult, since an exoskeleton only grows when it is shed, while
 * the mass rises between the moults as the insect feeds.
 */
export function growthRecord(insect: Insect) {
  return Arr.makeBy(RECORD_SAMPLES, (index) => {
    const snap = growthAt(insect, index / (RECORD_SAMPLES - 1));
    return { length: snap.lengthMm, mass: snap.massMg, x: index };
  });
}
