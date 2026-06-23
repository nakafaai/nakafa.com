import type { ExactPoint3 } from "@repo/math/schema/ast/schema";
import type {
  CoordinateAxis,
  CoordinatePrimitive,
} from "@repo/math/schema/coordinate/primitive";
import { readSortableExactScalar } from "@repo/math/schema/coordinate/scalar";
import { Schema } from "effect";

/** Schema-owned sortable point used by renderer-safety geometry checks. */
const SortablePoint3 = Schema.Struct({
  x: Schema.Number.pipe(Schema.finite()),
  y: Schema.Number.pipe(Schema.finite()),
  z: Schema.Number.pipe(Schema.finite()),
});

type SortablePoint3 = Schema.Schema.Type<typeof SortablePoint3>;

/** Schema-owned result of reading exact point coordinates into sortable values. */
const PointCoordinateRead = Schema.Union(
  Schema.Struct({
    issue: Schema.String,
    tag: Schema.Literal("Issue"),
  }),
  Schema.Struct({
    point: SortablePoint3,
    tag: Schema.Literal("Point"),
  })
);

type PointCoordinateRead = Schema.Schema.Type<typeof PointCoordinateRead>;

/**
 * Finds nonsortable point-like coordinates before primitives reach renderers.
 */
export function findPointLikeCoordinateIssue(primitive: CoordinatePrimitive) {
  if (primitive.kind === "point") {
    return findPointCoordinateIssue(primitive.id, "point", primitive.point);
  }

  if (primitive.kind === "vector") {
    if (primitive.tail) {
      const tailIssue = findPointCoordinateIssue(
        primitive.id,
        "vector tail",
        primitive.tail
      );
      if (tailIssue) {
        return tailIssue;
      }
    }

    return findPointCoordinateIssue(primitive.id, "vector", primitive.vector);
  }

  if (primitive.kind === "segment") {
    const start = readPointCoordinate(
      primitive.id,
      "segment start",
      primitive.start
    );
    if (start.tag === "Issue") {
      return start.issue;
    }

    const end = readPointCoordinate(primitive.id, "segment end", primitive.end);
    if (end.tag === "Issue") {
      return end.issue;
    }

    return findSegmentGeometryIssue(primitive.id, start.point, end.point);
  }

  if (primitive.kind === "ray") {
    return (
      findPointCoordinateIssue(primitive.id, "ray origin", primitive.origin) ??
      findPointCoordinateIssue(
        primitive.id,
        "ray direction",
        primitive.direction
      )
    );
  }

  if (primitive.kind === "line") {
    return (
      findPointCoordinateIssue(primitive.id, "line point", primitive.point) ??
      findPointCoordinateIssue(
        primitive.id,
        "line direction",
        primitive.direction
      )
    );
  }

  if (primitive.kind === "plane") {
    return (
      findPointCoordinateIssue(primitive.id, "plane point", primitive.point) ??
      findPointCoordinateIssue(primitive.id, "plane normal", primitive.normal)
    );
  }

  if (primitive.kind === "polygon") {
    return findPolygonCoordinateIssue(primitive.id, primitive.vertices);
  }

  if (primitive.kind === "sphere") {
    return findPointCoordinateIssue(
      primitive.id,
      "sphere center",
      primitive.center
    );
  }
}

/**
 * Returns one coordinate issue string for point-like primitive fields.
 */
function findPointCoordinateIssue(
  primitiveId: string,
  label: string,
  point: ExactPoint3
) {
  const result = readPointCoordinate(primitiveId, label, point);
  return result.tag === "Issue" ? result.issue : undefined;
}

/**
 * Validates all polygon vertices before area and duplicate checks run.
 */
function findPolygonCoordinateIssue(
  primitiveId: string,
  vertices: readonly ExactPoint3[]
) {
  const sortableVertices: SortablePoint3[] = [];

  for (const [index, vertex] of vertices.entries()) {
    const result = readPointCoordinate(
      primitiveId,
      `polygon vertex ${index + 1}`,
      vertex
    );
    if (result.tag === "Issue") {
      return result.issue;
    }
    sortableVertices.push(result.point);
  }

  const duplicate = findDuplicatePoint(sortableVertices);
  if (duplicate) {
    return `Coordinate primitive ${primitiveId} polygon vertex ${duplicate.duplicateIndex + 1} must not duplicate vertex ${duplicate.originalIndex + 1}.`;
  }

  return findPolygonAreaIssue(primitiveId, sortableVertices);
}

/**
 * Rejects segments whose decoded endpoints collapse to one point.
 */
function findSegmentGeometryIssue(
  primitiveId: string,
  startPoint: SortablePoint3,
  endPoint: SortablePoint3
) {
  if (isSamePoint(startPoint, endPoint)) {
    return `Coordinate primitive ${primitiveId} segment endpoints must be distinct.`;
  }
}

/**
 * Converts exact point fields into finite sortable coordinates.
 */
function readPointCoordinate(
  primitiveId: string,
  label: string,
  point: ExactPoint3
): PointCoordinateRead {
  const x = readSortableExactScalar(point.x);
  if (x === undefined) {
    return pointCoordinateIssue(primitiveId, label, "x");
  }

  const y = readSortableExactScalar(point.y);
  if (y === undefined) {
    return pointCoordinateIssue(primitiveId, label, "y");
  }

  const z = readSortableExactScalar(point.z);
  if (z === undefined) {
    return pointCoordinateIssue(primitiveId, label, "z");
  }

  return { point: { x, y, z }, tag: "Point" };
}

/**
 * Builds the shared coordinate-sortability failure result.
 */
function pointCoordinateIssue(
  primitiveId: string,
  label: string,
  axis: CoordinateAxis
): PointCoordinateRead {
  return {
    issue: `Coordinate primitive ${primitiveId} ${label} ${axis}-coordinate must use a sortable numeric value.`,
    tag: "Issue",
  };
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
 * Rejects polygon vertices that cannot span nonzero finite area.
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
  for (const [firstIndex, firstPoint] of remainingVertices.entries()) {
    const first = subtractPoints(firstPoint, anchor);
    const laterVertices = remainingVertices.slice(firstIndex + 1);

    for (const secondPoint of laterVertices) {
      const second = subtractPoints(secondPoint, anchor);
      const crossProduct = readCrossProduct(first, second);
      if (!crossProduct) {
        return `Coordinate primitive ${primitiveId} polygon area calculation must stay finite.`;
      }

      if (isNonzeroPoint(crossProduct)) {
        return;
      }
    }
  }

  return `Coordinate primitive ${primitiveId} polygon vertices must enclose nonzero area.`;
}

/**
 * Subtracts two decoded points as a vector for polygon area checks.
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
 * Returns true when any decoded vector component is nonzero.
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
