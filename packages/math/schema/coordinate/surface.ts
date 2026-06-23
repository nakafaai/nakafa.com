import type {
  CanonicalFunctionSpec,
  CoordinateAxis,
} from "@repo/math/schema/coordinate/primitive";

const COORDINATE_AXIS_NAMES = new Set<string>(["x", "y", "z"]);

/**
 * Finds output-axis contract issues in scalar coordinate surface functions.
 */
export function findFunctionSurfaceOutputIssue(
  primitiveId: string,
  outputAxis: CoordinateAxis,
  functionSpec: CanonicalFunctionSpec
) {
  if (functionSpec.domain.length !== 2) {
    return `Coordinate primitive ${primitiveId} must have exactly 2 function domain variables.`;
  }

  for (const domain of functionSpec.domain) {
    if (!COORDINATE_AXIS_NAMES.has(domain.variable)) {
      return `Coordinate primitive ${primitiveId} function surface domain ${domain.variable} must be a coordinate axis.`;
    }

    if (domain.variable === outputAxis) {
      return `Coordinate primitive ${primitiveId} function surface output axis ${outputAxis} must not be a domain variable.`;
    }
  }
}
