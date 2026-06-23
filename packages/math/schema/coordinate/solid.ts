import type { ExactPoint3, ExactScalar } from "@repo/math/schema/ast/schema";
import type { CoordinatePrimitive } from "@repo/math/schema/coordinate/primitive";
import { readSortableExactScalar } from "@repo/math/schema/coordinate/scalar";

/**
 * Finds finite scalar and axis-order issues on bounded solid primitives.
 */
export function findSolidPrimitiveIssue(primitive: CoordinatePrimitive) {
  if (primitive.kind === "sphere") {
    return findPositiveScalarIssue(
      primitive.id,
      "sphere radius",
      primitive.radius
    );
  }

  if (primitive.kind === "cuboid") {
    return findCuboidIssue(primitive.id, primitive.min, primitive.max);
  }
}

/**
 * Requires scalar geometry such as sphere radius to be finite and positive.
 */
function findPositiveScalarIssue(
  primitiveId: string,
  label: string,
  scalar: ExactScalar
) {
  const value = readSortableExactScalar(scalar);

  if (value === undefined) {
    return `Coordinate primitive ${primitiveId} ${label} must use a sortable numeric value.`;
  }

  if (value <= 0) {
    return `Coordinate primitive ${primitiveId} ${label} must be positive.`;
  }
}

/**
 * Requires cuboid min and max coordinates to be sortable and ordered per axis.
 */
function findCuboidIssue(
  primitiveId: string,
  min: ExactPoint3,
  max: ExactPoint3
) {
  const axes = [
    { name: "x", max: max.x, min: min.x },
    { name: "y", max: max.y, min: min.y },
    { name: "z", max: max.z, min: min.z },
  ];

  for (const axis of axes) {
    const minValue = readSortableExactScalar(axis.min);
    const maxValue = readSortableExactScalar(axis.max);

    if (minValue === undefined || maxValue === undefined) {
      return `Coordinate primitive ${primitiveId} cuboid ${axis.name}-axis must use sortable numeric bounds.`;
    }

    if (minValue >= maxValue) {
      return `Coordinate primitive ${primitiveId} cuboid ${axis.name}-axis must be increasing.`;
    }
  }
}
