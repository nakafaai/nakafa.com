import {
  readNumberScalar,
  readPointAxisNumber,
} from "@repo/math/artifact/scalar";
import {
  type ExactPoint3,
  ExactScalar,
  MathAst,
} from "@repo/math/schema/ast/schema";
import type { CoordinatePrimitive } from "@repo/math/schema/coordinate/primitive";
import {
  CanonicalVectorFunctionSpec,
  FunctionDomain,
} from "@repo/math/schema/coordinate/primitive";

/**
 * Creates a deterministic xy-plane circle as a bounded parametric curve.
 */
export function readCircleCurvePrimitive(
  center: ExactPoint3,
  edge: ExactPoint3
) {
  const radius = readCircleRadius(center, edge);

  return {
    function: CanonicalVectorFunctionSpec.make({
      domain: [readParameterDomain()],
      x: readTrigOffsetAst("x", center.x, radius, "cos"),
      y: readTrigOffsetAst("y", center.y, radius, "sin"),
      z: readLiteralAst("z", readNumberScalar(0)),
    }),
    id: "circle-1",
    kind: "parametric-curve",
    label: "Verified circle",
  } satisfies CoordinatePrimitive;
}

/**
 * Computes the deterministic radius from the center and one point on the circle.
 */
function readCircleRadius(center: ExactPoint3, edge: ExactPoint3) {
  const xDelta =
    readPointAxisNumber(edge, "x") - readPointAxisNumber(center, "x");
  const yDelta =
    readPointAxisNumber(edge, "y") - readPointAxisNumber(center, "y");

  return readNumberScalar(Math.hypot(xDelta, yDelta));
}

/**
 * Uses one full revolution as the finite render-time sampling domain.
 */
function readParameterDomain() {
  return FunctionDomain.make({
    closedMax: true,
    closedMin: true,
    max: readPiScalar("pi", Math.PI),
    min: readPiScalar("-pi", -Math.PI),
    variable: "t",
  });
}

/**
 * Builds one coordinate expression such as cx + r cos(t).
 */
function readTrigOffsetAst(
  axis: "x" | "y",
  offset: ExactScalar,
  radius: ExactScalar,
  operator: "cos" | "sin"
) {
  return MathAst.make({
    canonical: `${offset.expression}+${radius.expression}*${operator}(t)`,
    latex: `${offset.latex}+${radius.latex}\\${operator}(t)`,
    nodes: [
      { id: "offset", kind: "literal", value: offset },
      { id: "radius", kind: "literal", value: radius },
      { id: "t", kind: "variable", name: "t" },
      { id: operator, kind: "unary", operand: "t", operator },
      {
        id: "scaled",
        kind: "binary",
        left: "radius",
        operator: "multiply",
        right: operator,
      },
      {
        id: axis,
        kind: "binary",
        left: "offset",
        operator: "add",
        right: "scaled",
      },
    ],
    root: axis,
  });
}

/**
 * Builds one literal-only MathAst for constant coordinate components.
 */
function readLiteralAst(id: string, value: ExactScalar) {
  return MathAst.make({
    canonical: value.expression,
    latex: value.latex,
    nodes: [{ id, kind: "literal", value }],
    root: id,
  });
}

/**
 * Keeps the exact pi token while providing a finite decimal render hint.
 */
function readPiScalar(expression: "pi" | "-pi", decimal: number) {
  return ExactScalar.make({
    decimal,
    expression,
    latex: expression === "pi" ? "\\pi" : "-\\pi",
  });
}
