import type { LearningArtifact } from "@repo/math/schema/artifact/schema";
import type {
  ExactPoint3,
  ExactScalar,
  MathAst,
  MathAstNode,
} from "@repo/math/schema/ast/schema";
import type {
  CanonicalFunctionSpec,
  CanonicalVectorFunctionSpec,
  CoordinatePrimitive,
  FunctionDomain,
} from "@repo/math/schema/coordinate/primitive";

/**
 * Materializes schema-decoded coordinate payloads into Convex-storable values.
 * Effect owns class validation; Convex persists plain JSON-like records.
 */
export function readStoredPayload(artifact: LearningArtifact) {
  return {
    axes: {
      x: [
        readScalar(artifact.payload.axes.x[0]),
        readScalar(artifact.payload.axes.x[1]),
      ],
      y: [
        readScalar(artifact.payload.axes.y[0]),
        readScalar(artifact.payload.axes.y[1]),
      ],
      z: [
        readScalar(artifact.payload.axes.z[0]),
        readScalar(artifact.payload.axes.z[1]),
      ],
    },
    primitives: artifact.payload.primitives.map(readPrimitive),
    sampling: {
      curveSamples: artifact.payload.sampling.curveSamples,
      surfaceCells: artifact.payload.sampling.surfaceCells,
    },
  };
}

/**
 * Copies exact scalar fields so Schema.Class instances never reach Convex DB.
 */
function readScalar(scalar: ExactScalar) {
  if (scalar.decimal === undefined) {
    return {
      expression: scalar.expression,
      latex: scalar.latex,
    };
  }

  return {
    decimal: scalar.decimal,
    expression: scalar.expression,
    latex: scalar.latex,
  };
}

/**
 * Copies exact point fields into plain Convex object values.
 */
function readPoint(point: ExactPoint3) {
  return {
    x: readScalar(point.x),
    y: readScalar(point.y),
    z: readScalar(point.z),
  };
}

/**
 * Materializes each coordinate primitive variant without changing semantics.
 */
function readPrimitive(primitive: CoordinatePrimitive) {
  const common = {
    id: primitive.id,
    label: primitive.label,
  };

  switch (primitive.kind) {
    case "point":
      return {
        ...common,
        kind: primitive.kind,
        point: readPoint(primitive.point),
      };
    case "vector":
      return {
        ...common,
        kind: primitive.kind,
        tail: primitive.tail ? readPoint(primitive.tail) : undefined,
        vector: readPoint(primitive.vector),
      };
    case "segment":
      return {
        ...common,
        end: readPoint(primitive.end),
        kind: primitive.kind,
        start: readPoint(primitive.start),
      };
    case "ray":
      return {
        ...common,
        direction: readPoint(primitive.direction),
        kind: primitive.kind,
        origin: readPoint(primitive.origin),
      };
    case "line":
      return {
        ...common,
        direction: readPoint(primitive.direction),
        kind: primitive.kind,
        point: readPoint(primitive.point),
      };
    case "plane":
      return {
        ...common,
        equation: readFunction(primitive.equation),
        kind: primitive.kind,
        normal: readPoint(primitive.normal),
        point: readPoint(primitive.point),
      };
    case "polygon":
      return {
        ...common,
        kind: primitive.kind,
        vertices: primitive.vertices.map(readPoint),
      };
    case "cuboid":
      return {
        ...common,
        kind: primitive.kind,
        max: readPoint(primitive.max),
        min: readPoint(primitive.min),
      };
    case "sphere":
      return {
        ...common,
        center: readPoint(primitive.center),
        kind: primitive.kind,
        radius: readScalar(primitive.radius),
      };
    case "parametric-curve":
      return {
        ...common,
        function: readVectorFunction(primitive.function),
        kind: primitive.kind,
      };
    case "function-surface":
      return {
        ...common,
        function: readFunction(primitive.function),
        kind: primitive.kind,
        outputAxis: primitive.outputAxis,
      };
    case "parametric-surface":
      return {
        ...common,
        function: readVectorFunction(primitive.function),
        kind: primitive.kind,
      };
    default: {
      const exhaustive: never = primitive;
      return exhaustive;
    }
  }
}

/**
 * Copies scalar function specs, including bounded exclusions, into records.
 */
function readFunction(functionSpec: CanonicalFunctionSpec) {
  return {
    ast: readAst(functionSpec.ast),
    domain: functionSpec.domain.map(readDomain),
    exclusions: functionSpec.exclusions?.map(readAst),
    verifiedBy: functionSpec.verifiedBy,
  };
}

/**
 * Copies vector function specs used by curves and parametric surfaces.
 */
function readVectorFunction(functionSpec: CanonicalVectorFunctionSpec) {
  return {
    domain: functionSpec.domain.map(readDomain),
    x: readAst(functionSpec.x),
    y: readAst(functionSpec.y),
    z: readAst(functionSpec.z),
  };
}

/**
 * Copies one deterministic function domain into plain scalar bounds.
 */
function readDomain(domain: FunctionDomain) {
  return {
    closedMax: domain.closedMax,
    closedMin: domain.closedMin,
    max: readScalar(domain.max),
    min: readScalar(domain.min),
    variable: domain.variable,
  };
}

/**
 * Copies MathAst display metadata and graph nodes into plain values.
 */
function readAst(ast: MathAst) {
  return {
    canonical: ast.canonical,
    latex: ast.latex,
    nodes: ast.nodes.map(readAstNode),
    root: ast.root,
  };
}

/**
 * Copies one MathAst node variant without evaluating the expression.
 */
function readAstNode(node: MathAstNode) {
  switch (node.kind) {
    case "literal":
      return {
        id: node.id,
        kind: node.kind,
        value: readScalar(node.value),
      };
    case "variable":
      return { id: node.id, kind: node.kind, name: node.name };
    case "unary":
      return {
        id: node.id,
        kind: node.kind,
        operand: node.operand,
        operator: node.operator,
      };
    case "binary":
      return {
        id: node.id,
        kind: node.kind,
        left: node.left,
        operator: node.operator,
        right: node.right,
      };
    default: {
      const exhaustive: never = node;
      return exhaustive;
    }
  }
}
