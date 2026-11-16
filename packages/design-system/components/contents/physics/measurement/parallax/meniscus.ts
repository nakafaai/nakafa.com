/**
 * Reading water in a measuring cylinder. The scale is printed on the front
 * wall, but the bottom of the meniscus sits on the cylinder's axis, one
 * radius behind it. An eye level with the meniscus reads the true volume; an
 * eye above or below it sees the meniscus through a higher or lower point on
 * the wall, so the reading drifts by the eye's height times the radius over
 * the eye's distance from the axis, in cubic centimetres of cylinder.
 */

/** The cylinder's inner radius, in centimetres. */
export const CYLINDER_RADIUS = 1.5;

/** How far the eye is from the cylinder's axis, in centimetres. */
export const EYE_DISTANCE = 30;

/** The volume of water in the cylinder, in millilitres. */
export const TRUE_VOLUME = 42;

/** The cylinder's full scale, in millilitres. */
export const CYLINDER_VOLUME = 100;

/** The farthest the eye moves above or below the meniscus, in centimetres. */
export const EYE_RANGE = 8;

/** The cross-section of the cylinder, in square centimetres: one millilitre fills this much height. */
export const CYLINDER_AREA = Math.PI * CYLINDER_RADIUS ** 2;

/** The height of `volume` millilitres of water above the cylinder's base, in centimetres. */
export function levelOf(volume: number) {
  return volume / CYLINDER_AREA;
}

/**
 * What an eye `offset` centimetres above the meniscus (below it when
 * negative) reads: the height where its sight line to the meniscus bottom
 * crosses the front wall, the volume printed there, and the error.
 */
export function parallaxReading(offset: number) {
  const level = levelOf(TRUE_VOLUME);
  const seen = level + (offset * CYLINDER_RADIUS) / EYE_DISTANCE;
  const reading = seen * CYLINDER_AREA;
  return { error: reading - TRUE_VOLUME, level, reading, seen };
}
