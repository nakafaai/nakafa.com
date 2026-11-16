import type { Orbit } from "@/lib/island/camera";
import { lookAt, multiply, orthographic } from "@/lib/island/matrix";

/** The shadow map's side in texels (ADR 0047, D43): one hard map for the sun, or the moon at night. */
export const SHADOW_SIZE = 2048;

/** How far back along the light the light's own camera stands from the camera's target, in blocks; its box reaches as far again past it. */
const REACH = 160;

/**
 * The light's own view of the ground around the camera's target (ADR 0047,
 * D43), which the shadow map is drawn from: a box that looks along the light,
 * as wide as what the camera sees at its distance, in steps of four blocks so
 * a zoom does not stretch it each frame. Its middle moves in whole texels, so
 * a shadow's edge holds still while the camera pans. With its matrix comes
 * the width of one texel in blocks, which a face is lifted by before its
 * shadow is read, so it never shadows itself.
 */
export function sunViewOf(
  orbit: Orbit,
  toward: readonly [number, number, number],
  size = SHADOW_SIZE
) {
  const half = Math.ceil(Math.max(24, orbit.distance * 0.9) / 4) * 4;
  const eye = [
    orbit.target[0] + toward[0] * REACH,
    orbit.target[1] + toward[1] * REACH,
    orbit.target[2] + toward[2] * REACH,
  ] as const;
  const view = lookAt(eye, orbit.target);
  const texel = (2 * half) / size;
  view[12] = Math.round(view[12] / texel) * texel;
  view[13] = Math.round(view[13] / texel) * texel;
  return { matrix: multiply(orthographic(half, 1, REACH * 2), view), texel };
}
