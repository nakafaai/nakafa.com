import { HEIGHT, SPAN } from "@repo/backend/confect/island/world";
import { Schema } from "effect";
import { TILE } from "@/lib/island/tiles/paint";
import { SEA_LEVEL } from "@/lib/island/world";

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

/** The closest and farthest the camera may be. */
export const DISTANCE = { far: 180, near: 10 } as const;

/** The lowest and highest tilt, 15 to 55 degrees over the ground: always a three-quarter view, never flat or straight down. */
export const PITCH = {
  high: (55 * Math.PI) / 180,
  low: (15 * Math.PI) / 180,
} as const;

/** The step the drawn camera's turn snaps to, so a turn changes the blocks' pixels in whole steps instead of crawling. */
export const YAW_STEP = Math.PI / 180;

/** How fast the camera closes on where it is going, per second, the same at any frame rate. */
const EASE_RATE = 17;

/** The longest frame the camera eases over, so a stalled frame never jumps it. */
const LONGEST_FRAME = 1 / 15;

/** The share of the way to its goal the camera covers in a frame of `seconds`, alike at 30, 60 or 120 frames a second. */
export function easeShare(seconds: number) {
  return (
    1 - Math.exp(-Math.min(LONGEST_FRAME, Math.max(0, seconds)) * EASE_RATE)
  );
}

/** The cells across the opening view frames: the village square, close enough that a person reads at a glance (D21). */
const FRAMED = 16;

/**
 * The cells across the opening view of a portrait phone: fewer, so the
 * learner's fox and the square around it read at a glance on a narrow screen,
 * and a pinch shows the rest of the village.
 */
const FRAMED_PORTRAIT = 12;

/** Below this aspect, width over height, a screen opens as a portrait phone. */
const PORTRAIT = 0.75;

/**
 * The camera an island of this footprint side opens with, on a screen of this
 * aspect (width over height): its village in view from the south-east,
 * farther back on a narrow screen so the square fits across it, and closer on
 * a portrait phone, which frames fewer cells.
 */
export function openingOrbit(size: number, aspect: number): Orbit {
  const across = Math.atan(Math.tan(FIELD_OF_VIEW / 2) * Math.min(1, aspect));
  const framed = aspect < PORTRAIT ? FRAMED_PORTRAIT : FRAMED;
  return {
    distance: Math.min(
      DISTANCE.far,
      (Math.min(size, framed) * 0.62) / Math.tan(across) + 6
    ),
    pitch: 0.72,
    target: [SPAN / 2, SEA_LEVEL + 1, SPAN / 2],
    yaw: Math.PI / 4,
  };
}

/** The camera's position in the world. */
export function eyeOf(orbit: Orbit) {
  const flat = Math.cos(orbit.pitch) * orbit.distance;
  return [
    orbit.target[0] + Math.sin(orbit.yaw) * flat,
    orbit.target[1] + Math.sin(orbit.pitch) * orbit.distance,
    orbit.target[2] + Math.cos(orbit.yaw) * flat,
  ] as const;
}

/** Keeps a camera inside its limits, and its target over the world. */
export function clampOrbit(orbit: Orbit): Orbit {
  const clamp = (value: number, low: number, high: number) =>
    Math.min(high, Math.max(low, value));
  return {
    distance: clamp(orbit.distance, DISTANCE.near, DISTANCE.far),
    pitch: clamp(orbit.pitch, PITCH.low, PITCH.high),
    target: [
      clamp(orbit.target[0], 0, SPAN),
      clamp(orbit.target[1], 0, HEIGHT),
      clamp(orbit.target[2], 0, SPAN),
    ],
    yaw: orbit.yaw,
  };
}

/**
 * Moves the target across the ground by a drag of `dx`, `dy` screen pixels on a
 * screen `height` pixels tall, so the ground under the finger follows it.
 */
export function panOrbit(orbit: Orbit, dx: number, dy: number, height: number) {
  const perPixel =
    (2 * orbit.distance * Math.tan(FIELD_OF_VIEW / 2)) / Math.max(1, height);
  const across = dx * perPixel;
  const along = (dy * perPixel) / Math.max(0.35, Math.sin(orbit.pitch));
  const [cos, sin] = [Math.cos(orbit.yaw), Math.sin(orbit.yaw)];
  return clampOrbit({
    ...orbit,
    target: [
      orbit.target[0] - across * cos - along * sin,
      orbit.target[1],
      orbit.target[2] + across * sin - along * cos,
    ],
  });
}

/** Moves the camera closer (a factor under 1) or farther (over 1). */
export function zoomOrbit(orbit: Orbit, factor: number) {
  return clampOrbit({ ...orbit, distance: orbit.distance * factor });
}

/**
 * Moves the camera closer (a factor under 1) or farther toward `point`, a
 * point of the world on the screen, which stays where it is on the screen:
 * the eye and the target both slide along their lines to it.
 */
export function zoomToward(
  orbit: Orbit,
  point: readonly [number, number, number],
  factor: number
) {
  const distance = Math.min(
    DISTANCE.far,
    Math.max(DISTANCE.near, orbit.distance * factor)
  );
  const share = distance / orbit.distance;
  return clampOrbit({
    ...orbit,
    distance,
    target: [
      point[0] + (orbit.target[0] - point[0]) * share,
      point[1] + (orbit.target[1] - point[1]) * share,
      point[2] + (orbit.target[2] - point[2]) * share,
    ],
  });
}

/** Turns the camera around its target and tilts it. */
export function turnOrbit(orbit: Orbit, yaw: number, pitch = 0) {
  return clampOrbit({
    ...orbit,
    pitch: orbit.pitch + pitch,
    yaw: orbit.yaw + yaw,
  });
}

/** Eases one camera toward another by `t` of the way, the yaw by its shortest turn. */
export function easeOrbit(from: Orbit, to: Orbit, t: number): Orbit {
  const mix = (a: number, b: number) => a + (b - a) * t;
  const turn = Math.atan2(
    Math.sin(to.yaw - from.yaw),
    Math.cos(to.yaw - from.yaw)
  );
  return {
    distance: mix(from.distance, to.distance),
    pitch: mix(from.pitch, to.pitch),
    target: [
      mix(from.target[0], to.target[0]),
      mix(from.target[1], to.target[1]),
      mix(from.target[2], to.target[2]),
    ],
    yaw: from.yaw + turn * t,
  };
}

/**
 * The camera moved onto the grid of art pixels (ADR 0047, D20): its turn
 * snaps to whole `YAW_STEP`s and its target slides across the screen's plane
 * to the nearest whole art pixel, so neither a turn nor a pan makes the
 * blocks' pixels crawl, and `shift` is what was rounded away, in art pixels
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
