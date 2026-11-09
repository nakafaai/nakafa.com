import {
  type Point3,
  Point3Schema,
} from "@repo/design-system/lib/geometry/point";
import { triangulatePolygon } from "@repo/design-system/lib/geometry/polygon";
import { Array as Arr, MutableList, Option, Schema } from "effect";
import { BufferAttribute, BufferGeometry } from "three";

/** One indexed triangle mesh, ready for a buffer geometry. */
export const MeshArraysSchema = Schema.Struct({
  indices: Schema.instanceOf(Uint32Array),
  positions: Schema.instanceOf(Float32Array),
});
export type MeshArrays = typeof MeshArraysSchema.Type;

/** A surface sampled on a grid, row by row, with nothing where it is undefined. */
export const MeshGridSchema = Schema.Struct({
  columns: Schema.Int,
  points: Schema.Array(Schema.Option(Point3Schema)),
  rows: Schema.Int,
});
export type MeshGrid = typeof MeshGridSchema.Type;

/** Flattens points into the x, y, z triples a position buffer holds. */
function flatten(points: readonly Point3[]) {
  return new Float32Array(Arr.flatMap(points, ({ x, y, z }) => [x, y, z]));
}

/**
 * Joins convex shapes into one mesh, each fanned from its first corner, so a
 * shaded region of thousands of cells draws in one call.
 */
export function fanMesh(shapes: readonly (readonly Point3[])[]): MeshArrays {
  const indices = MutableList.make<number>();
  let start = 0;
  for (const shape of shapes) {
    for (let corner = 1; corner < shape.length - 1; corner += 1) {
      MutableList.appendAll(indices, [
        start,
        start + corner,
        start + corner + 1,
      ]);
    }
    start += shape.length;
  }
  return {
    indices: new Uint32Array(MutableList.toArray(indices)),
    positions: flatten(Arr.flatten(shapes)),
  };
}

/**
 * Builds the two triangles of every grid cell whose four corners are defined,
 * so an undefined part of a surface stays a hole instead of a false sheet.
 */
export function gridMesh(grid: MeshGrid): MeshArrays {
  const width = grid.columns + 1;
  const present = Arr.map(grid.points, Option.isSome);
  const indices = MutableList.make<number>();
  for (let row = 0; row < grid.rows; row += 1) {
    for (let column = 0; column < grid.columns; column += 1) {
      const a = row * width + column;
      const b = a + 1;
      const d = a + width;
      const c = d + 1;
      if (present[a] && present[b] && present[c] && present[d]) {
        MutableList.appendAll(indices, [a, b, c, a, c, d]);
      }
    }
  }
  const positions = Arr.map(grid.points, (point) =>
    Option.getOrElse(point, (): Point3 => ({ x: 0, y: 0, z: 0 }))
  );
  return {
    indices: new Uint32Array(MutableList.toArray(indices)),
    positions: flatten(positions),
  };
}

/** Joins the flat faces of a solid into one mesh, triangulating each face. */
export function faceMesh(faces: readonly (readonly Point3[])[]): MeshArrays {
  const indices = MutableList.make<number>();
  let start = 0;
  for (const face of faces) {
    const offset = start;
    MutableList.appendAll(
      indices,
      Arr.map(triangulatePolygon(face), (corner) => offset + corner)
    );
    start += face.length;
  }
  return {
    indices: new Uint32Array(MutableList.toArray(indices)),
    positions: flatten(Arr.flatten(faces)),
  };
}

/** Builds the buffer geometry of one mesh, with the vertex normals a lit material shades by. */
export function meshGeometry(mesh: MeshArrays) {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(mesh.positions, 3));
  geometry.setIndex(new BufferAttribute(mesh.indices, 1));
  geometry.computeVertexNormals();
  return geometry;
}
