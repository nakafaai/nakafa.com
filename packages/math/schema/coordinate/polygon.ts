import {
  addPlaneCoefficient,
  multiplyFinitePlaneScalars,
} from "@repo/math/schema/coordinate/coefficient";
import type { SortablePoint3 } from "@repo/math/schema/coordinate/point";

/**
 * Validates decoded polygon vertices before renderer-ready persistence.
 */
export function findPolygonGeometryIssue(
  primitiveId: string,
  vertices: readonly SortablePoint3[]
) {
  const duplicate = findDuplicatePoint(vertices);
  if (duplicate) {
    return `Coordinate primitive ${primitiveId} polygon vertex ${duplicate.duplicateIndex + 1} must not duplicate vertex ${duplicate.originalIndex + 1}.`;
  }

  return findPolygonAreaIssue(primitiveId, vertices);
}

/**
 * Finds the first duplicate polygon vertex pair after numeric decoding.
 */
function findDuplicatePoint(vertices: readonly SortablePoint3[]) {
  for (const [originalIndex, original] of vertices.entries()) {
    const remainingVertices = vertices.slice(originalIndex + 1);

    for (const [remainingIndex, duplicate] of remainingVertices.entries()) {
      if (isSamePoint(original, duplicate)) {
        const duplicateIndex = originalIndex + remainingIndex + 1;
        return { duplicateIndex, originalIndex };
      }
    }
  }
}

/**
 * Rejects polygons without a finite nonzero plane or with off-plane vertices.
 */
function findPolygonAreaIssue(
  primitiveId: string,
  vertices: readonly SortablePoint3[]
) {
  const anchor = vertices[0];
  if (!anchor) {
    return `Coordinate primitive ${primitiveId} polygon vertices must enclose nonzero area.`;
  }

  const remainingVertices = vertices.slice(1);
  const planeNormal = readPolygonPlaneNormal(
    primitiveId,
    anchor,
    remainingVertices
  );
  if (typeof planeNormal === "string") {
    return planeNormal;
  }

  if (!planeNormal) {
    return `Coordinate primitive ${primitiveId} polygon vertices must enclose nonzero area.`;
  }

  return findPolygonPlanarityIssue(
    primitiveId,
    anchor,
    planeNormal,
    remainingVertices
  );
}

/**
 * Finds one finite nonzero anchor triangle normal for the polygon plane.
 */
function readPolygonPlaneNormal(
  primitiveId: string,
  anchor: SortablePoint3,
  vertices: readonly SortablePoint3[]
) {
  for (const [firstIndex, firstPoint] of vertices.entries()) {
    const first = subtractPoints(firstPoint, anchor);
    const laterVertices = vertices.slice(firstIndex + 1);

    for (const secondPoint of laterVertices) {
      const second = subtractPoints(secondPoint, anchor);
      const crossProduct = readCrossProduct(first, second);
      if (!crossProduct) {
        return `Coordinate primitive ${primitiveId} polygon area calculation must stay finite.`;
      }

      if (isNonzeroPoint(crossProduct)) {
        return crossProduct;
      }
    }
  }
}

/**
 * Checks that every decoded vertex lies on the discovered polygon plane.
 */
function findPolygonPlanarityIssue(
  primitiveId: string,
  anchor: SortablePoint3,
  normal: SortablePoint3,
  vertices: readonly SortablePoint3[]
) {
  for (const vertex of vertices) {
    const dotProduct = readDotProduct(normal, subtractPoints(vertex, anchor));
    if (dotProduct === undefined) {
      return `Coordinate primitive ${primitiveId} polygon planarity calculation must stay finite.`;
    }

    if (dotProduct !== 0) {
      return `Coordinate primitive ${primitiveId} polygon vertices must be coplanar.`;
    }
  }
}

/**
 * Builds the vector difference for polygon geometry checks.
 */
function subtractPoints(left: SortablePoint3, right: SortablePoint3) {
  return {
    x: left.x - right.x,
    y: left.y - right.y,
    z: left.z - right.z,
  };
}

/**
 * Computes a finite cross product or rejects overflowed components.
 */
function readCrossProduct(left: SortablePoint3, right: SortablePoint3) {
  const x = left.y * right.z - left.z * right.y;
  const y = left.z * right.x - left.x * right.z;
  const z = left.x * right.y - left.y * right.x;

  if (!(Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z))) {
    return;
  }

  return { x, y, z };
}

/**
 * Computes a finite dot product without losing nonzero products or sums.
 */
function readDotProduct(left: SortablePoint3, right: SortablePoint3) {
  const x = multiplyFinitePlaneScalars(left.x, right.x);
  const y = multiplyFinitePlaneScalars(left.y, right.y);
  const z = multiplyFinitePlaneScalars(left.z, right.z);
  if (x === undefined || y === undefined || z === undefined) {
    return;
  }

  const xy = addPlaneCoefficient(x, y);
  return xy === undefined ? undefined : addPlaneCoefficient(xy, z);
}

/**
 * Returns true when at least one decoded vector component is nonzero.
 */
function isNonzeroPoint(point: SortablePoint3) {
  return point.x !== 0 || point.y !== 0 || point.z !== 0;
}

/**
 * Compares decoded coordinates exactly after scalar parsing.
 */
function isSamePoint(left: SortablePoint3, right: SortablePoint3) {
  return left.x === right.x && left.y === right.y && left.z === right.z;
}
