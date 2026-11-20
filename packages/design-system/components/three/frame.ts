import type { Point3 } from "@repo/design-system/lib/geometry/point";
import { Schema } from "effect";

const CoordinateRangeSchema = Schema.Struct({
  max: Schema.Finite,
  min: Schema.Finite,
});

/** A box of the scene in world units, such as the region a camera frames first. */
export const CoordinateFrameSchema = Schema.Struct({
  x: CoordinateRangeSchema,
  y: CoordinateRangeSchema,
  z: CoordinateRangeSchema,
});
export type CoordinateFrame = typeof CoordinateFrameSchema.Type;

const CoordinateTupleSchema = Schema.Tuple([
  Schema.Finite,
  Schema.Finite,
  Schema.Finite,
]);
export type CoordinateTuple = typeof CoordinateTupleSchema.Type;

const ORIGIN: Point3 = { x: 0, y: 0, z: 0 };

/**
 * The three axes of an unbounded world: each runs through the origin along its
 * direction, across the whole reach, the box of half-width `reach` around the
 * world's center that a camera can ever show. An axis whose line misses that
 * box, such as the x axis of a frame from y = 35 to 39 far below it, is never
 * in view and draws nothing.
 */
export function createAxisGeometry(reach: number, origin: Point3 = ORIGIN) {
  const within = (value: number) => Math.abs(value) <= reach;
  return {
    x: {
      from: { ...origin, x: -reach },
      to: { ...origin, x: reach },
      visible: within(origin.y) && within(origin.z),
    },
    y: {
      from: { ...origin, y: -reach },
      to: { ...origin, y: reach },
      visible: within(origin.x) && within(origin.z),
    },
    z: {
      from: { ...origin, z: -reach },
      to: { ...origin, z: reach },
      visible: within(origin.x) && within(origin.y),
    },
  };
}
