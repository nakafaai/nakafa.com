import { Array as Arr, Match, Schema } from "effect";

const SUBJECTS = ["body", "stem"] as const;
export const PLANES = ["sagittal", "frontal", "transverse"] as const;
export const PAIRS = ["vertical", "front", "side", "limb"] as const;
export const SECTIONS = ["transverse", "longitudinal"] as const;

const SubjectSchema = Schema.Literals(SUBJECTS);
const PlaneSchema = Schema.Literals(PLANES);
const PairSchema = Schema.Literals(PAIRS);
const SectionSchema = Schema.Literals(SECTIONS);

export type Subject = typeof SubjectSchema.Type;
export type Plane = typeof PlaneSchema.Type;
export type Pair = typeof PairSchema.Type;
export type Section = typeof SectionSchema.Type;

const PlanePoseSchema = Schema.Struct({
  position: Schema.Tuple([Schema.Finite, Schema.Finite, Schema.Finite]),
  rotation: Schema.Tuple([Schema.Finite, Schema.Finite, Schema.Finite]),
  size: Schema.Tuple([Schema.Finite, Schema.Finite]),
});

export type PlanePose = typeof PlanePoseSchema.Type;

const PairAxisSchema = Schema.Struct({
  end: Schema.Tuple([Schema.Finite, Schema.Finite, Schema.Finite]),
  start: Schema.Tuple([Schema.Finite, Schema.Finite, Schema.Finite]),
});

export type PairAxis = typeof PairAxisSchema.Type;

const StemSliceSchema = Schema.Struct({
  bundles: Schema.Array(Schema.Finite),
  position: Schema.Tuple([Schema.Finite, Schema.Finite, Schema.Finite]),
  rotation: Schema.Tuple([Schema.Finite, Schema.Finite, Schema.Finite]),
  size: Schema.Tuple([Schema.Finite, Schema.Finite]),
});

export type StemSlice = typeof StemSliceSchema.Type;

/** Clamp cut position to the normalized slider domain [-1, 1]. */
export function clampPosition(value: number): number {
  return Math.max(-1, Math.min(1, value));
}

/**
 * Position, Euler rotation, and sheet size of an anatomical cutting plane
 * across a 1.72-unit human body standing in anatomical position (facing +Z).
 */
export function planePose(plane: Plane, position: number): PlanePose {
  const t = clampPosition(position);
  return Match.value(plane).pipe(
    Match.when("sagittal", () => ({
      position: [t * 0.24, 0.86, 0] as const,
      rotation: [0, Math.PI / 2, 0] as const,
      size: [0.95, 1.9] as const,
    })),
    Match.when("frontal", () => ({
      position: [0, 0.86, t * 0.16] as const,
      rotation: [0, 0, 0] as const,
      size: [1.15, 1.9] as const,
    })),
    Match.when("transverse", () => ({
      position: [0, 0.86 + t * 0.68, 0] as const,
      rotation: [Math.PI / 2, 0, 0] as const,
      size: [1.15, 0.9] as const,
    })),
    Match.exhaustive
  );
}

/** Endpoints of each anatomical direction pair on the standing human figure. */
export function pairAxis(pair: Pair): PairAxis {
  return Match.value(pair).pipe(
    Match.when("vertical", () => ({
      end: [0.52, 0.14, 0] as const,
      start: [0.52, 1.66, 0] as const,
    })),
    Match.when("front", () => ({
      end: [0.46, 1.05, -0.34] as const,
      start: [0.46, 1.05, 0.34] as const,
    })),
    Match.when("side", () => ({
      end: [0.46, 1.06, 0.18] as const,
      start: [0, 1.06, 0.18] as const,
    })),
    Match.when("limb", () => ({
      end: [-0.43, 0.72, 0.08] as const,
      start: [-0.26, 1.3, 0.04] as const,
    })),
    Match.exhaustive
  );
}

/** Ring of vascular bundle angles and cut plane pose on a dicot stem. */
export function stemSlice(section: Section, position: number): StemSlice {
  const t = clampPosition(position);
  const bundles = Arr.makeBy(10, (index) => (index / 10) * Math.PI * 2);
  return Match.value(section).pipe(
    Match.when("transverse", () => ({
      bundles,
      position: [0, 0.65 + t * 0.42, 0] as const,
      rotation: [Math.PI / 2, 0, 0] as const,
      size: [1.1, 1.1] as const,
    })),
    Match.when("longitudinal", () => ({
      bundles,
      position: [t * 0.18, 0.65, 0] as const,
      rotation: [0, Math.PI / 2, 0] as const,
      size: [1.1, 1.45] as const,
    })),
    Match.exhaustive
  );
}
