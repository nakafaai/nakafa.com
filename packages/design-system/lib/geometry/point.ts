import { Schema } from "effect";

/** A point in three-dimensional space, as its x, y and z coordinates. */
export const Point3Schema = Schema.Struct({
  x: Schema.Finite,
  y: Schema.Finite,
  z: Schema.Finite,
});

export type Point3 = typeof Point3Schema.Type;
