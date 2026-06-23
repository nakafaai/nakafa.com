import {
  hasTwoPoints,
  readCoordinateArtifactGeometry,
  readExactInputPoints,
  readPointLabel,
} from "@repo/math/artifact/geometry";
import type { LearningArtifactDisplayCopy } from "@repo/math/schema/artifact/copy";
import {
  COORDINATE_SYSTEM_ARTIFACT_KIND,
  decodeLearningArtifact,
} from "@repo/math/schema/artifact/schema";
import type { ExactPoint3 } from "@repo/math/schema/ast/schema";
import type { MathData } from "@repo/math/schema/data";
import type { MathRequest } from "@repo/math/schema/request";
import { Effect, Schema } from "effect";

const DERIVABLE_POINT_OPERATIONS = new Set([
  "circle",
  "distance",
  "intersection",
  "line",
  "midpoint",
  "slope",
]);

const DEFAULT_CURVE_SAMPLES = 64;
const DEFAULT_SURFACE_CELLS = 16;

/** Expected failure when deterministic math evidence cannot form an artifact. */
export class CoordinateArtifactDerivationError extends Schema.TaggedError<CoordinateArtifactDerivationError>()(
  "CoordinateArtifactDerivationError",
  {
    message: Schema.String,
  }
) {}

/**
 * Detects math requests whose user-facing visualization is the 3D artifact.
 */
export function isCoordinateArtifactRequest(request: MathRequest) {
  return (
    DERIVABLE_POINT_OPERATIONS.has(request.operation) &&
    (request.points?.length ?? 0) >= 2
  );
}

/**
 * Derives compact coordinate artifacts from verified CAS point geometry.
 * Unsupported or symbolic inputs return no artifact rather than persisting
 * model-authored coordinates.
 */
export const deriveCoordinateArtifactsFromMathData = Effect.fn(
  "math.artifact.deriveCoordinateArtifacts"
)(function* ({
  artifactId,
  copy,
  data,
  proofAnchor,
}: {
  readonly artifactId: string;
  readonly copy?: LearningArtifactDisplayCopy;
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

  const geometry = readCoordinateArtifactGeometry(
    data.result.operation,
    points
  );
  const displayCopy = readArtifactCopy(data.result.operation, points, copy);

  const artifact = yield* decodeLearningArtifact({
    description: displayCopy.description,
    id: artifactId,
    kind: COORDINATE_SYSTEM_ARTIFACT_KIND,
    payload: {
      axes: geometry.axes,
      primitives: geometry.primitives,
      sampling: {
        curveSamples: DEFAULT_CURVE_SAMPLES,
        surfaceCells: DEFAULT_SURFACE_CELLS,
      },
    },
    proofAnchors: [proofAnchor],
    title: displayCopy.title,
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
 * Picks LLM-authored display copy when valid and deterministic fallback otherwise.
 */
function readArtifactCopy(
  operation: string,
  points: readonly ExactPoint3[] & {
    readonly 0: ExactPoint3;
    readonly 1: ExactPoint3;
  },
  copy?: LearningArtifactDisplayCopy
) {
  if (copy) {
    return {
      description: copy.description.trim(),
      title: copy.title.trim(),
    };
  }

  return readFallbackArtifactCopy(operation, points);
}

/**
 * Provides deterministic copy only for non-LLM callers and tests.
 */
function readFallbackArtifactCopy(
  operation: string,
  points: readonly ExactPoint3[] & {
    readonly 0: ExactPoint3;
    readonly 1: ExactPoint3;
  }
) {
  if (operation === "line" || operation === "slope") {
    return {
      description:
        "Exact coordinate geometry renders the verified points and the full line direction.",
      title: `Line through ${readPointLabel(points[0])} and ${readPointLabel(points[1])}`,
    };
  }

  if (operation === "circle") {
    return {
      description:
        "Exact coordinate geometry renders the verified center and radius point as a 3D circle path.",
      title: `Circle from ${readPointLabel(points[0])} through ${readPointLabel(points[1])}`,
    };
  }

  return {
    description: `Exact coordinate geometry renders the verified ${operation} relationship.`,
    title: `Verified ${operation} relationship`,
  };
}
