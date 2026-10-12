import { Record, Schema } from "effect";

/**
 * Where an animal stands. It rarely stands in the middle: it leans in from a
 * lower corner, or peeks over the bottom edge. A pose is a turn in degrees, a
 * scale, and a shift from the middle of the bottom edge, plus how far the eyes
 * look to the side.
 */
export const POSES = {
  right: { look: -2.6, size: 1.16, turn: -10, x: 34, y: 18 },
  left: { look: 2.6, size: 1.16, turn: 10, x: -34, y: 18 },
  center: { look: 0, size: 1.04, turn: 0, x: 0, y: 4 },
  peek: { look: 0, size: 1.12, turn: 0, x: 0, y: 54 },
  "peek-right": { look: -2.6, size: 1.14, turn: -14, x: 44, y: 46 },
  "peek-left": { look: 2.6, size: 1.14, turn: 14, x: -44, y: 46 },
};

/** The name of a pose. */
export const Pose = Schema.Literals(Record.keys(POSES));

/** The poses that a seed picks from, in order. The leaning poses come twice. */
export const POSE_ORDER = [
  "right",
  "left",
  "right",
  "left",
  "center",
  "peek-right",
  "peek-left",
  "peek",
] satisfies readonly (typeof Pose.Type)[];
