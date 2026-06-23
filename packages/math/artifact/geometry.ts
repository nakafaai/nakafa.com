import { readCircleCurvePrimitive } from "@repo/math/artifact/curve";
import {
  readNumberScalar,
  readPointAxisNumber,
} from "@repo/math/artifact/scalar";
import { ExactPoint3, ExactScalar } from "@repo/math/schema/ast/schema";
import { readExactNumericExpression } from "@repo/math/schema/coordinate/numeric";
import type { CoordinatePrimitive } from "@repo/math/schema/coordinate/primitive";
import type { MathData } from "@repo/math/schema/data";

const MIN_AXIS_PADDING = 1;

/**
 * Converts verified point inputs into exact geometry ready for artifact decode.
 */
export function readCoordinateArtifactGeometry(
  operation: string,
  points: readonly ExactPoint3[] & {
    readonly 0: ExactPoint3;
    readonly 1: ExactPoint3;
  }
) {
  return {
    axes: readAxisRanges(points),
    primitives: [
      ...readPointPrimitives(points),
      ...readRelationshipPrimitives(operation, points),
    ],
  };
}

/**
 * Converts all request points to sortable exact 3D points or rejects the batch.
 */
export function readExactInputPoints(
  points: NonNullable<
    Extract<MathData, { readonly result: unknown }>["result"]["input"]["points"]
  >
) {
  const exactPoints: ExactPoint3[] = [];
  for (const point of points) {
    const exactPoint = readExactInputPoint(point);
    if (!exactPoint) {
      return [];
    }
    exactPoints.push(exactPoint);
  }

  return exactPoints;
}

/**
 * Narrows decoded input points to the minimum renderable relationship.
 */
export function hasTwoPoints(
  points: readonly ExactPoint3[]
): points is readonly ExactPoint3[] & {
  readonly 0: ExactPoint3;
  readonly 1: ExactPoint3;
} {
  return points.length >= 2;
}

/**
 * Formats one exact point for compact deterministic fallback copy.
 */
export function readPointLabel(point: ExactPoint3) {
  return `(${point.x.expression}, ${point.y.expression})`;
}

/**
 * Lifts one CAS request point into the 3D coordinate artifact domain.
 */
function readExactInputPoint(point: {
  readonly x: string;
  readonly y: string;
}) {
  const x = readExactScalar(point.x);
  const y = readExactScalar(point.y);
  const z = readExactScalar("0");

  if (!(x && y && z)) {
    return;
  }

  return ExactPoint3.make({ x, y, z });
}

/**
 * Parses a finite exact scalar before it can become durable geometry.
 */
function readExactScalar(expression: string) {
  const trimmed = expression.trim();
  const decimal = readExactNumericExpression(trimmed);
  if (decimal === undefined) {
    return;
  }

  return ExactScalar.make({
    decimal,
    expression: trimmed,
    latex: trimmed,
  });
}

/**
 * Creates one primitive per verified input point.
 */
function readPointPrimitives(points: readonly ExactPoint3[]) {
  return points.map((point, index) => ({
    id: `point-${index + 1}`,
    kind: "point",
    label: `Point ${index + 1}`,
    point,
  })) satisfies CoordinatePrimitive[];
}

/**
 * Creates the geometry relationship that should dominate the renderer.
 */
function readRelationshipPrimitives(
  operation: string,
  points: readonly ExactPoint3[] & {
    readonly 0: ExactPoint3;
    readonly 1: ExactPoint3;
  }
) {
  const [first, second, third, fourth] = points;
  if (operation === "line" || operation === "slope") {
    return [readLinePrimitive("line-1", first, second, "Verified line")];
  }

  if (operation === "intersection" && third && fourth) {
    return [
      readLinePrimitive("line-1", first, second, "Line 1"),
      readLinePrimitive("line-2", third, fourth, "Line 2"),
    ];
  }

  if (operation === "circle") {
    return [readCircleCurvePrimitive(first, second)];
  }

  return [readSegmentPrimitive("segment-1", first, second, "Segment")];
}

/**
 * Creates one exact line primitive from two already-validated points.
 */
function readLinePrimitive(
  id: string,
  first: ExactPoint3,
  second: ExactPoint3,
  label: string
) {
  return {
    direction: readDirectionVector(first, second),
    id,
    kind: "line",
    label,
    point: first,
  } satisfies CoordinatePrimitive;
}

/**
 * Creates one exact segment primitive from two already-validated points.
 */
function readSegmentPrimitive(
  id: string,
  start: ExactPoint3,
  end: ExactPoint3,
  label: string
) {
  return {
    end,
    id,
    kind: "segment",
    label,
    start,
  } satisfies CoordinatePrimitive;
}

/**
 * Builds an exact direction vector from two renderer-safe points.
 */
function readDirectionVector(first: ExactPoint3, second: ExactPoint3) {
  return ExactPoint3.make({
    x: readNumberScalar(
      readPointAxisNumber(second, "x") - readPointAxisNumber(first, "x")
    ),
    y: readNumberScalar(
      readPointAxisNumber(second, "y") - readPointAxisNumber(first, "y")
    ),
    z: readNumberScalar(0),
  });
}

/**
 * Frames all verified points with a small deterministic numeric margin.
 */
function readAxisRanges(points: readonly ExactPoint3[]) {
  const xValues = points.map((point) => readPointAxisNumber(point, "x"));
  const yValues = points.map((point) => readPointAxisNumber(point, "y"));

  return {
    x: readAxisRange(xValues),
    y: readAxisRange(yValues),
    z: [
      readNumberScalar(-MIN_AXIS_PADDING),
      readNumberScalar(MIN_AXIS_PADDING),
    ],
  };
}

/**
 * Builds one increasing exact axis range from finite point coordinates.
 */
function readAxisRange(values: readonly number[]) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min;
  const padding = Math.max(MIN_AXIS_PADDING, span * 0.1);

  return [readNumberScalar(min - padding), readNumberScalar(max + padding)];
}
