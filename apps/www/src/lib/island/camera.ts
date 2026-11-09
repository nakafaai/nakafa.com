import { Schema } from "effect";
import { HEIGHT, SEA_LEVEL, SPAN } from "@/lib/island/world";

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
export const DISTANCE = { far: 120, near: 10 } as const;

/** The lowest and highest tilt, from almost level to almost straight down. */
export const PITCH = { high: 1.35, low: 0.32 } as const;

/** The camera an island of this footprint side opens with: its whole island in view from the south-east. */
export function openingOrbit(size: number): Orbit {
  return {
    distance: Math.min(DISTANCE.far, size * 1.35 + 12),
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
