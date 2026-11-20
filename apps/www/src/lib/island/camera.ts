import { Schema } from "effect";

/** The art pixels across one block at the closest zoom, which the frame's own pixel is sized by (ADR 0047, D20). */
const TILE = 16;

/**
 * The orbiting camera (ADR 0047, D5): the point it looks at, how far it is
 * turned around that point (`yaw`) and tilted over it (`pitch`), and its
 * distance. The renderer reads it; gestures and keys change it.
 */
export const Orbit = Schema.Struct({
  distance: Schema.Finite,
  pitch: Schema.Finite,
  target: Schema.Tuple([Schema.Finite, Schema.Finite, Schema.Finite]),
  yaw: Schema.Finite,
});
export type Orbit = typeof Orbit.Type;

/** The narrow lens of a diorama: little distortion, so blocks keep their shape. */
export const FIELD_OF_VIEW = (32 * Math.PI) / 180;

/**
 * How far past the camera's focus the air starts to hide the land, and where
 * it has hidden all of it, in blocks: the land thins toward the horizon and
 * never ends at an edge.
 */
export const FOG = { from: 70, to: 620 } as const;

/** The closest and farthest the camera may be. */
export const DISTANCE = { far: 180, near: 7 } as const;

/** The lowest and highest tilt, 15 to 55 degrees over the ground: always a three-quarter view, never flat or straight down. */
export const PITCH = {
  high: (55 * Math.PI) / 180,
  low: (15 * Math.PI) / 180,
} as const;

/** The step the drawn camera's turn snaps to, so a turn changes the blocks' pixels in whole steps instead of crawling. */
export const YAW_STEP = Math.PI / 180;

/** The camera's position in the world. */
export function eyeOf(orbit: Orbit) {
  const flat = Math.cos(orbit.pitch) * orbit.distance;
  return [
    orbit.target[0] + Math.sin(orbit.yaw) * flat,
    orbit.target[1] + Math.sin(orbit.pitch) * orbit.distance,
    orbit.target[2] + Math.cos(orbit.yaw) * flat,
  ] as const;
}

/**
 * The camera moved onto the grid of art pixels (ADR 0047, D20): its turn
 * snaps to whole `YAW_STEP`s and its target slides across the screen's plane
 * to the nearest whole art pixel, so neither a turn nor a pan makes the
 * world's pixels crawl, and `shift` is what was rounded away, in art pixels
 * right and up, for the enlarged frame to move back by. `rows` is the height
 * of the screen in art pixels.
 */
export function snapOrbit(unsnapped: Orbit, rows: number) {
  const orbit = {
    ...unsnapped,
    yaw: Math.round(unsnapped.yaw / YAW_STEP) * YAW_STEP,
  };
  const pixel =
    (2 * orbit.distance * Math.tan(FIELD_OF_VIEW / 2)) / Math.max(1, rows);
  const [cy, sy] = [Math.cos(orbit.yaw), Math.sin(orbit.yaw)];
  const [cp, sp] = [Math.cos(orbit.pitch), Math.sin(orbit.pitch)];
  const right = [cy, 0, -sy] as const;
  const up = [-sp * sy, cp, -sp * cy] as const;
  const along = (axis: readonly [number, number, number]) =>
    (orbit.target[0] * axis[0] +
      orbit.target[1] * axis[1] +
      orbit.target[2] * axis[2]) /
    pixel;
  const [x, y] = [along(right), along(up)];
  const [dx, dy] = [Math.round(x) - x, Math.round(y) - y];
  return {
    orbit: {
      ...orbit,
      target: [
        orbit.target[0] + (right[0] * dx + up[0] * dy) * pixel,
        orbit.target[1] + (right[1] * dx + up[1] * dy) * pixel,
        orbit.target[2] + (right[2] * dx + up[2] * dy) * pixel,
      ] as const,
    },
    shift: [dx, dy] as const,
  };
}

/** The share a texel's size must cross past the art pixel's edge before the art pixel changes, so a zoom resting on an edge does not flicker between two. */
const SETTLE = 0.12;

/**
 * The art pixel, in device pixels, for a canvas `width` by `height` seeing
 * the ground `distance` blocks away (ADR 0047, D47): as many device pixels as
 * one texel of a block at the camera's target covers, so every texel there is
 * at least one art pixel and nothing averages into mush however far the
 * camera pulls back. It is never coarser than the screen's own art pixel,
 * its short side over 270, nor finer than one device pixel; `coarse` keeps
 * that screen art pixel at every zoom, the quality ladder's lowest rung. It
 * changes from `previous` only once the texel crosses an edge by `SETTLE`.
 */
export function artPixelFor(
  width: number,
  height: number,
  distance: number,
  previous: number,
  coarse: boolean
) {
  const screen = Math.max(1, Math.round(Math.min(width, height) / 270));
  if (coarse) {
    return screen;
  }
  const block = height / (2 * distance * Math.tan(FIELD_OF_VIEW / 2));
  const texel = block / TILE;
  const settled =
    texel >= previous * (1 - SETTLE) && texel < (previous + 1) * (1 + SETTLE);
  const pixel = settled ? previous : Math.floor(texel);
  return Math.max(1, Math.min(screen, pixel));
}
