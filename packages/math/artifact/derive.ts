import {
  COORDINATE_SYSTEM_ARTIFACT_KIND,
  decodeLearningArtifact,
} from "@repo/math/schema/artifact/schema";
import { ExactPoint3, ExactScalar } from "@repo/math/schema/ast/schema";
import { readExactNumericExpression } from "@repo/math/schema/coordinate/numeric";
import type { CoordinatePrimitive } from "@repo/math/schema/coordinate/primitive";
import type { MathData } from "@repo/math/schema/data";
import { Effect, Schema } from "effect";

const DERIVABLE_POINT_OPERATIONS = new Set([
  "distance",
  "intersection",
  "line",
  "midpoint",
  "slope",
]);

const DEFAULT_CURVE_SAMPLES = 64;
const DEFAULT_SURFACE_CELLS = 16;
const MIN_AXIS_PADDING = 1;

/** Expected failure when deterministic math evidence cannot form an artifact. */
export class CoordinateArtifactDerivationError extends Schema.TaggedError<CoordinateArtifactDerivationError>()(
  "CoordinateArtifactDerivationError",
  {
    message: Schema.String,
  }
) {}

/**
 * Derives compact coordinate artifacts from verified CAS point geometry.
 * Unsupported or symbolic inputs return no artifact rather than persisting
 * model-authored coordinates.
 */
export const deriveCoordinateArtifactsFromMathData = Effect.fn(
  "math.artifact.deriveCoordinateArtifacts"
)(function* ({
  artifactId,
  data,
  proofAnchor,
}: {
  readonly artifactId: string;
  readonly data: MathData;
  readonly proofAnchor: string;
}) {
  if (!isDerivableCoordinateData(data)) {
    return [];
  }

  const points = readExactInputPoints(data.result.input.points ?? []);
  if (!hasTwoPoints(points)) {
    return [];
  }

  const primitives = [
    ...readPointPrimitives(points),
    ...readSegmentPrimitives(data.result.operation, points),
  ];

  const artifact = yield* decodeLearningArtifact({
    description: `Derived from verified ${data.result.operation} geometry evidence.`,
    id: artifactId,
    kind: COORDINATE_SYSTEM_ARTIFACT_KIND,
    payload: {
      axes: readAxisRanges(points),
      primitives,
      sampling: {
        curveSamples: DEFAULT_CURVE_SAMPLES,
        surfaceCells: DEFAULT_SURFACE_CELLS,
      },
    },
    proofAnchors: [proofAnchor],
    title: readArtifactTitle(data.result.operation),
  }).pipe(
    Effect.mapError(
      (error) =>
        new CoordinateArtifactDerivationError({ message: error.message })
    )
  );

  return [artifact];
});

/**
 * Accepts only verified point-based coordinate geometry results.
 */
function isDerivableCoordinateData(
  data: MathData
): data is Extract<
  MathData,
  { status: "contradicted" | "inconclusive" | "verified" }
> {
  return (
    data.status !== "loading" &&
    data.status !== "error" &&
    data.result.status === "verified" &&
    DERIVABLE_POINT_OPERATIONS.has(data.result.operation)
  );
}

/**
 * Converts all request points to sortable exact 3D points or rejects the batch.
 */
function readExactInputPoints(
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
function hasTwoPoints(
  points: readonly ExactPoint3[]
): points is readonly ExactPoint3[] & {
  readonly 0: ExactPoint3;
  readonly 1: ExactPoint3;
} {
  return points.length >= 2;
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
 * Creates the minimum segment geometry needed to show point relationships.
 */
function readSegmentPrimitives(
  operation: string,
  points: readonly ExactPoint3[] & {
    readonly 0: ExactPoint3;
    readonly 1: ExactPoint3;
  }
) {
  const [first, second, third, fourth] = points;
  if (operation === "intersection" && third && fourth) {
    return [
      readSegmentPrimitive("segment-1", first, second, "Line 1"),
      readSegmentPrimitive("segment-2", third, fourth, "Line 2"),
    ];
  }

  return [readSegmentPrimitive("segment-1", first, second, "Segment")];
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
 * Frames all verified points with a small deterministic numeric margin.
 */
function readAxisRanges(points: readonly ExactPoint3[]) {
  const xValues = points.map((point) => Number(point.x.expression));
  const yValues = points.map((point) => Number(point.y.expression));

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

/**
 * Converts a finite renderer bound into an exact scalar metadata row.
 */
function readNumberScalar(value: number) {
  const expression = String(value);

  return ExactScalar.make({
    decimal: value,
    expression,
    latex: expression,
  });
}

/**
 * Names the artifact by the deterministic geometry operation that justified it.
 */
function readArtifactTitle(operation: string) {
  return `Coordinate ${operation} evidence`;
}
