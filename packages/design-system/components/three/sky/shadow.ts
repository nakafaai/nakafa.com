/** How far the key light stands from the lab's middle, in reaches. */
const DISTANCE = 2.4;

/** How many texels of the shadow map a surface is pushed along its normal before it is compared. */
const NORMAL_TEXELS = 1.6;

/** The widest a shadow's edge is blurred, in texels. */
const SOFTEST = 2.2;

/** How wide a shadow's edge is, as a part of the width the map covers. */
const EDGE = 0.0011;

/**
 * Fits the key light's shadow to a lab. The light's box covers the lab's
 * reach and nothing more, so every texel of the map lands on the lab. The
 * offsets that keep a lit surface from shadowing itself follow the size of
 * one texel on the ground: too little and the surface speckles, too much
 * and a shadow parts from the foot that casts it. The edge is blurred across
 * the same small part of the lab on every device, so a smaller map gives no
 * wider blur, and never across less than one texel, so no map shows its
 * texels. Nothing here depends on the camera, so shadows do not swim when
 * it moves.
 *
 * @param reach - How far the lab reaches from its middle, in scene units
 * @param size - The width of the shadow map in texels
 */
export function fitShadow(reach: number, size: number) {
  const texel = (2 * reach) / size;
  return {
    bias: -0.000_15,
    distance: DISTANCE * reach,
    far: (DISTANCE + 2) * reach,
    near: (DISTANCE - 2) * reach,
    normalBias: NORMAL_TEXELS * texel,
    radius: Math.min(SOFTEST, Math.max(1, EDGE * size)),
  };
}
