import {
  axisAngle,
  IDENTITY,
  type Quaternion,
  type Triple,
} from "@repo/design-system/components/contents/mathematics/dice/turn";
import { Array as Arr, Schema } from "effect";

/**
 * A standard 16 mm die, in metres. Its edges are rounded to a 1.5 mm radius,
 * its pips are drilled 2.8 mm across and painted, and opposite faces add up
 * to 7. Western dice are right-handed: seen from the corner where 1, 2 and 3
 * meet, those faces run counterclockwise. In the die's own frame 1 faces +y,
 * 2 faces +z and 3 faces +x, which is that order, and 6, 5 and 4 face the
 * other way.
 */
export const DIE = {
  half: 0.008,
  pip: 0.0014,
  radius: 0.0015,
  spread: 0.0042,
} as const;

/** The six faces of a die, numbered by their pips. */
export const FaceSchema = Schema.Literals([1, 2, 3, 4, 5, 6]);
export type Face = typeof FaceSchema.Type;

/** Every face, from 1 to 6. */
export const FACES = FaceSchema.literals;

/**
 * Each face's outward direction in the die's frame, and the two directions
 * across it that its pips are laid out along.
 */
export const FACE_FRAMES = {
  1: { across: [1, 0, 0], down: [0, 0, 1], normal: [0, 1, 0] },
  2: { across: [1, 0, 0], down: [0, -1, 0], normal: [0, 0, 1] },
  3: { across: [0, 0, -1], down: [0, -1, 0], normal: [1, 0, 0] },
  4: { across: [0, 0, 1], down: [0, -1, 0], normal: [-1, 0, 0] },
  5: { across: [-1, 0, 0], down: [0, -1, 0], normal: [0, 0, -1] },
  6: { across: [1, 0, 0], down: [0, 0, -1], normal: [0, -1, 0] },
} as const satisfies Record<Face, Record<"across" | "down" | "normal", Triple>>;

/** The turn of the die that leaves `face` on top, facing +y. */
export const FACE_UP = {
  1: IDENTITY,
  2: axisAngle([1, 0, 0], -Math.PI / 2),
  3: axisAngle([0, 0, 1], Math.PI / 2),
  4: axisAngle([0, 0, 1], -Math.PI / 2),
  5: axisAngle([1, 0, 0], Math.PI / 2),
  6: axisAngle([1, 0, 0], Math.PI),
} satisfies Record<Face, Quaternion>;

/** Where each pip of a face sits, in steps of the pip spread across and down it. */
const PIP_GRID = {
  1: [[0, 0]],
  2: [
    [-1, -1],
    [1, 1],
  ],
  3: [
    [-1, -1],
    [0, 0],
    [1, 1],
  ],
  4: [
    [-1, -1],
    [-1, 1],
    [1, -1],
    [1, 1],
  ],
  5: [
    [-1, -1],
    [-1, 1],
    [0, 0],
    [1, -1],
    [1, 1],
  ],
  6: [
    [-1, -1],
    [-1, 0],
    [-1, 1],
    [1, -1],
    [1, 0],
    [1, 1],
  ],
} as const satisfies Record<Face, readonly (readonly [number, number])[]>;

/**
 * Every pip of the die in its own frame: the centre of its painted dish just
 * proud of the face, and the face's outward direction it looks along.
 */
export function pipPlacements() {
  return Arr.flatMap(FACES, (face) => {
    const { across, down, normal } = FACE_FRAMES[face];
    return Arr.map(PIP_GRID[face], ([step, row]) => ({
      normal,
      position: [
        normal[0] * DIE.half + (across[0] * step + down[0] * row) * DIE.spread,
        normal[1] * DIE.half + (across[1] * step + down[1] * row) * DIE.spread,
        normal[2] * DIE.half + (across[2] * step + down[2] * row) * DIE.spread,
      ] satisfies Triple,
    }));
  });
}
