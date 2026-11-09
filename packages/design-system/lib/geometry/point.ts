import { Array as Arr, Schema } from "effect";

/** A point in three-dimensional space, as its x, y and z coordinates. */
export const Point3Schema = Schema.Struct({
  x: Schema.Finite,
  y: Schema.Finite,
  z: Schema.Finite,
});

export type Point3 = typeof Point3Schema.Type;

/** Names a run of points by its coordinates, a stable key for a list of edges or loops. */
export function pointsKey(points: readonly Point3[]) {
  return Arr.join(
    Arr.map(points, ({ x, y, z }) => `${x},${y},${z}`),
    " "
  );
}
