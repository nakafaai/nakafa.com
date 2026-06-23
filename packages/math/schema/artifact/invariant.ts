import type { LearningArtifact } from "@repo/math/schema/artifact/schema";
import type { ExactScalar } from "@repo/math/schema/ast/schema";
import type { CoordinatePrimitive } from "@repo/math/schema/coordinate/primitive";
import { readSortableExactScalar } from "@repo/math/schema/coordinate/scalar";

/**
 * Finds cross-field artifact issues that cannot be expressed by Schema alone.
 */
export function findLearningArtifactInvariantIssue(artifact: LearningArtifact) {
  const duplicateId = findDuplicatePrimitiveId(artifact.payload.primitives);
  if (duplicateId) {
    return `Duplicate coordinate primitive id: ${duplicateId}.`;
  }

  return findAxisRangeIssue(artifact);
}

/**
 * Reads the first duplicate primitive id while preserving input order.
 */
function findDuplicatePrimitiveId(primitives: readonly CoordinatePrimitive[]) {
  const ids = new Set<string>();

  for (const primitive of primitives) {
    if (ids.has(primitive.id)) {
      return primitive.id;
    }
    ids.add(primitive.id);
  }
}

/**
 * Checks all renderer axis ranges against sortable finite scalar bounds.
 */
function findAxisRangeIssue(artifact: LearningArtifact) {
  const xIssue = findOneAxisRangeIssue("x", artifact.payload.axes.x);
  if (xIssue) {
    return xIssue;
  }

  const yIssue = findOneAxisRangeIssue("y", artifact.payload.axes.y);
  if (yIssue) {
    return yIssue;
  }

  return findOneAxisRangeIssue("z", artifact.payload.axes.z);
}

/**
 * Validates one axis range so frame bounds cannot invert or become symbolic.
 */
function findOneAxisRangeIssue(
  axisName: "x" | "y" | "z",
  range: readonly [ExactScalar, ExactScalar]
) {
  const min = readSortableExactScalar(range[0]);
  const max = readSortableExactScalar(range[1]);

  if (min === undefined) {
    return `Coordinate artifact ${axisName}-axis range must use sortable numeric bounds.`;
  }

  if (max === undefined) {
    return `Coordinate artifact ${axisName}-axis range must use sortable numeric bounds.`;
  }

  if (min >= max) {
    return `Coordinate artifact ${axisName}-axis range must be increasing.`;
  }
}
