import { Record, Schema } from "effect";

/**
 * Where an animal stands. It rarely stands in the middle: it leans in from a
 * lower corner, or peeks over the bottom edge. A pose is a turn in degrees, a
 * scale, and a shift from the middle of the bottom edge, plus how far the eyes
 * look to the side. The head fills most of the circle in every pose, and the
 * edge cuts the shoulders, never the face.
 */
export const POSES = {
  right: { look: -3, size: 1.06, turn: -8, x: 14, y: 12 },
  left: { look: 3, size: 1.06, turn: 8, x: -14, y: 12 },
  center: { look: 0, size: 1.02, turn: 0, x: 0, y: 6 },
  peek: { look: 0, size: 1.08, turn: 0, x: 0, y: 44 },
  "peek-right": { look: -3, size: 1.06, turn: -12, x: 22, y: 36 },
  "peek-left": { look: 3, size: 1.06, turn: 12, x: -22, y: 36 },
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
