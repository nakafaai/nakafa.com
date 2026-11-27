import { Option, Schema } from "effect";

/**
 * The laws a ray of light obeys where it meets an optical element, in the
 * plane the ray travels in. A boundary between two media bends it by Snell's
 * law, n₁ sin θ₁ = n₂ sin θ₂, or reflects it totally when no refracted ray
 * exists. A mirror turns it about the normal. A thin lens changes its slope
 * by its height over the focal length, which is the whole of 1/f = 1/u + 1/v.
 */

/** A direction or a normal in the plane of the ray, as a unit vector. */
const HeadingSchema = Schema.Tuple([Schema.Finite, Schema.Finite]);
type Heading = typeof HeadingSchema.Type;

/**
 * The direction of a ray after it crosses a boundary from a medium of index
 * `from` into one of index `to`, or none when it is totally reflected. The
 * normal may point to either side of the boundary.
 *
 * @param heading - The unit direction the ray travels in
 * @param normal - A unit normal of the boundary
 * @param from - The refractive index of the medium the ray leaves
 * @param to - The refractive index of the medium the ray enters
 */
export function bend(
  heading: Heading,
  normal: Heading,
  from: number,
  to: number
) {
  const toward = heading[0] * normal[0] + heading[1] * normal[1];
  const side = toward > 0 ? -1 : 1;
  const cosine = Math.abs(toward);
  const ratio = from / to;
  const inside = 1 - ratio * ratio * (1 - cosine * cosine);
  if (inside < 0) {
    return Option.none<Heading>();
  }
  const along = ratio * cosine - Math.sqrt(inside);
  return Option.some<Heading>([
    ratio * heading[0] + along * side * normal[0],
    ratio * heading[1] + along * side * normal[1],
  ]);
}

/**
 * The direction of a ray after a mirror, or a totally reflecting face, turns
 * it about the `normal`.
 *
 * @param heading - The unit direction the ray travels in
 * @param normal - A unit normal of the mirror
 */
export function bounce(heading: Heading, normal: Heading): Heading {
  const toward = heading[0] * normal[0] + heading[1] * normal[1];
  return [
    heading[0] - 2 * toward * normal[0],
    heading[1] - 2 * toward * normal[1],
  ];
}

/**
 * The slope of a ray after a thin lens of focal length `focal`, which it
 * meets `height` above the axis: a converging lens tips it toward the axis
 * by its height over the focal length.
 *
 * @param height - How far above the axis the ray meets the lens
 * @param slope - The ray's rise per unit along the axis before the lens
 * @param focal - The focal length, positive for a converging lens
 */
export function converge(height: number, slope: number, focal: number) {
  return slope - height / focal;
}
