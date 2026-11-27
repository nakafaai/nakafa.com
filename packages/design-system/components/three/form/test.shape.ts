import type { Point } from "@repo/design-system/components/three/form/path";
import {
  cross,
  dot,
  size,
  sub,
} from "@repo/design-system/components/three/form/path";
import type { Shape } from "@repo/design-system/components/three/form/sweep";
import { Array as Arr } from "effect";

/** The vertices of a built surface, as points. */
export function verticesOf(shape: Shape) {
  return Arr.makeBy(
    shape.positions.length / 3,
    (index): Point => [
      shape.positions[index * 3],
      shape.positions[index * 3 + 1],
      shape.positions[index * 3 + 2],
    ]
  );
}

/** The normals of a built surface, as vectors. */
export function normalsOf(shape: Shape) {
  return Arr.makeBy(
    shape.normals.length / 3,
    (index): Point => [
      shape.normals[index * 3],
      shape.normals[index * 3 + 1],
      shape.normals[index * 3 + 2],
    ]
  );
}

/**
 * How a surface's triangles lie against its normals: how many face the way
 * their vertices' normals do, how many face the other way, and how many have
 * no area at all.
 */
export function facesOf(shape: Shape) {
  const vertices = verticesOf(shape);
  const normals = normalsOf(shape);
  const faces = Arr.makeBy(shape.indices.length / 3, (face) => {
    const [a, b, c] = [
      shape.indices[face * 3],
      shape.indices[face * 3 + 1],
      shape.indices[face * 3 + 2],
    ];
    const facing = cross(
      sub(vertices[b], vertices[a]),
      sub(vertices[c], vertices[a])
    );
    const agreed =
      dot(facing, normals[a]) +
      dot(facing, normals[b]) +
      dot(facing, normals[c]);
    return { agreed, area: size(facing) };
  });
  return {
    empty: Arr.filter(faces, (face) => face.area < 1e-14).length,
    inward: Arr.filter(faces, (face) => face.area >= 1e-14 && face.agreed <= 0)
      .length,
    outward: Arr.filter(faces, (face) => face.area >= 1e-14 && face.agreed > 0)
      .length,
  };
}

/** Whether every number of a surface is finite and every normal has unit length. */
export function isSound(shape: Shape) {
  return (
    Arr.every(Arr.fromIterable(shape.positions), Number.isFinite) &&
    Arr.every(Arr.fromIterable(shape.uvs), Number.isFinite) &&
    Arr.every(normalsOf(shape), (normal) => Math.abs(size(normal) - 1) < 1e-5)
  );
}
