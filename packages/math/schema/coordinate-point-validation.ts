import type { ExactPoint3 } from "@repo/math/schema/ast";
import type { CoordinatePrimitive } from "@repo/math/schema/coordinate-primitives";
import { readNonSortablePointAxis } from "@repo/math/schema/coordinate-scalars";

/** Finds nonsortable point-like coordinates before primitives reach renderers. */
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
    const startIssue = findPointCoordinateIssue(
      primitive.id,
      "segment start",
      primitive.start
    );
    if (startIssue) {
      return startIssue;
    }

    return findPointCoordinateIssue(primitive.id, "segment end", primitive.end);
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

function findPointCoordinateIssue(
  primitiveId: string,
  label: string,
  point: ExactPoint3
) {
  const axis = readNonSortablePointAxis(point);
  if (!axis) {
    return;
  }

  return `Coordinate primitive ${primitiveId} ${label} ${axis}-coordinate must use a sortable numeric value.`;
}

function findPolygonCoordinateIssue(
  primitiveId: string,
  vertices: readonly ExactPoint3[]
) {
  for (const [index, vertex] of vertices.entries()) {
    const issue = findPointCoordinateIssue(
      primitiveId,
      `polygon vertex ${index + 1}`,
      vertex
    );
    if (issue) {
      return issue;
    }
  }
}
