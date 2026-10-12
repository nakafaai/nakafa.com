import { Record, Schema } from "effect";

/**
 * Where an animal stands. It rarely stands in the middle: it leans in from a
 * lower corner, or peeks over the bottom edge. A pose is a turn in degrees, a
 * scale, and a shift from the middle of the bottom edge, plus how far the eyes
 * look to the side.
 */
export const POSES = {
  kanan: { look: -2.6, size: 1.16, turn: -10, x: 34, y: 18 },
  kiri: { look: 2.6, size: 1.16, turn: 10, x: -34, y: 18 },
  tengah: { look: 0, size: 1.04, turn: 0, x: 0, y: 4 },
  intip: { look: 0, size: 1.12, turn: 0, x: 0, y: 54 },
  "intip-kanan": { look: -2.6, size: 1.14, turn: -14, x: 44, y: 46 },
  "intip-kiri": { look: 2.6, size: 1.14, turn: 14, x: -44, y: 46 },
};

/** The name of a pose. */
export const Pose = Schema.Literals(Record.keys(POSES));

/** The poses that a seed picks from, in order. The leaning poses come twice. */
export const POSE_ORDER = [
  "kanan",
  "kiri",
  "kanan",
  "kiri",
  "tengah",
  "intip-kanan",
  "intip-kiri",
  "intip",
] satisfies readonly (typeof Pose.Type)[];
