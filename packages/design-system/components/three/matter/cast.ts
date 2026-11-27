import type { BufferGeometry, Object3D, PointLight } from "three";
import { Matrix4, Mesh, Vector3 } from "three";

/** How many reaches of its lab a light is followed over before it has faded to nothing. */
const FAR = 2;

const corners = [new Vector3(), new Vector3(), new Vector3()] as const;
const middle = new Vector3();
const placed = new Matrix4();
const inward = new Matrix4();

/**
 * How much surface a geometry has and where its middle lies, each triangle
 * weighed by its area, once `place` has moved it to where it is drawn.
 */
function surfaceOf(geometry: BufferGeometry, place: Matrix4) {
  const points = geometry.getAttribute("position");
  const order = geometry.getIndex();
  const count = order === null ? points.count : order.count;
  const [a, b, c] = corners;
  let area = 0;
  let x = 0;
  let y = 0;
  let z = 0;
  for (let corner = 0; corner + 2 < count; corner += 3) {
    a.fromBufferAttribute(points, order?.getX(corner) ?? corner);
    b.fromBufferAttribute(points, order?.getX(corner + 1) ?? corner + 1);
    c.fromBufferAttribute(points, order?.getX(corner + 2) ?? corner + 2);
    a.applyMatrix4(place);
    b.applyMatrix4(place);
    c.applyMatrix4(place);
    middle.copy(a).add(b).add(c).divideScalar(3);
    const face = b.sub(a).cross(c.sub(a)).length() / 2;
    area += face;
    x += middle.x * face;
    y += middle.y * face;
    z += middle.z * face;
  }
  return { area, x, y, z };
}

/**
 * The glowing surface of a part: a mesh, or everything drawn inside a
 * group, hidden or not. `area` is how much of it there is, in the part's
 * own units, and `x`, `y` and `z` are where its middle lies in the part.
 */
export function glowingOf(part: Object3D) {
  const whole = { area: 0, x: 0, y: 0, z: 0 };
  part.updateWorldMatrix(true, true);
  inward.copy(part.matrixWorld).invert();
  part.traverse((piece) => {
    if (!(piece instanceof Mesh)) {
      return;
    }
    placed.multiplyMatrices(inward, piece.matrixWorld);
    const surface = surfaceOf(piece.geometry, placed);
    whole.area += surface.area;
    whole.x += surface.x;
    whole.y += surface.y;
    whole.z += surface.z;
  });
  if (whole.area === 0) {
    return whole;
  }
  return {
    area: whole.area,
    x: whole.x / whole.area,
    y: whole.y / whole.area,
    z: whole.z / whole.area,
  };
}

/** A number that changes when a part is given another shape: the sum of what it and everything inside it draw. */
function shapeOf(part: Object3D): number {
  let sum = part instanceof Mesh ? part.geometry.id : 0;
  for (const piece of part.children) {
    sum += shapeOf(piece);
  }
  return sum;
}

/**
 * What a light runs before each frame to shine for the part it is put in.
 * When the part takes a shape it has not met, it measures how much glowing
 * surface the part has, as large as the lab draws it, and stands in its
 * middle unless its author `set` it somewhere. After that it costs one sum
 * over the part: it throws `cast` from each unit of that surface, times
 * `level` for a rig that fades it, and is followed as far as the lab's
 * `reach` makes worthwhile. The light falls off with the square of the
 * distance, as light does.
 */
export function tendShine(reach: number, set: boolean) {
  const kept = { area: 0, shape: Number.NaN };
  return (lamp: PointLight, cast: number, level: number) => {
    const part = lamp.parent;
    if (part === null) {
      return;
    }
    const shape = shapeOf(part);
    if (shape !== kept.shape) {
      kept.shape = shape;
      const glowing = glowingOf(part);
      const drawn = Math.cbrt(Math.abs(part.matrixWorld.determinant()));
      kept.area = glowing.area * drawn ** 2;
      if (!set) {
        lamp.position.set(glowing.x, glowing.y, glowing.z);
      }
    }
    lamp.decay = 2;
    lamp.distance = reach * FAR;
    lamp.intensity = cast * kept.area * level;
  };
}
