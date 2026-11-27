import { BufferGeometry, Float32BufferAttribute } from "three";

/** One point of a skin, in the part's own space. */
type SkinPoint = readonly [x: number, y: number, z: number];

/**
 * A smooth skin stretched over a row of rings, as a boat builder planks a
 * hull over its frames: a turbine blade over its aerofoil sections, a
 * nacelle over its bulkheads. `at` names the point of each ring by how far
 * along the part the ring stands and how far round the ring the point lies,
 * both from 0 to 1. The seam of every ring lies at 0, so a part puts its one
 * sharp edge there. The texture runs once round the rings and once along
 * the part, and the faces look outward when the rings run counterclockwise
 * seen from the part's far end.
 *
 * @param rings - How many spans lie between the first ring and the last
 * @param around - How many faces go round each ring
 * @param at - The point at a share `along` the part and `round` its ring
 */
export function skin(
  rings: number,
  around: number,
  at: (along: number, round: number) => SkinPoint
) {
  const positions: number[] = [];
  const places: number[] = [];
  const faces: number[] = [];
  const row = around + 1;
  for (let ring = 0; ring <= rings; ring += 1) {
    for (let step = 0; step <= around; step += 1) {
      positions.push(...at(ring / rings, step / around));
      places.push(step / around, ring / rings);
    }
  }
  for (let ring = 0; ring < rings; ring += 1) {
    for (let step = 0; step < around; step += 1) {
      const near = ring * row + step;
      const far = near + row;
      faces.push(near, near + 1, far, near + 1, far + 1, far);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(places, 2));
  geometry.setIndex(faces);
  geometry.computeVertexNormals();
  return geometry;
}
