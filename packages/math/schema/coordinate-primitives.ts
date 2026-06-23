import {
  ExactPoint3,
  ExactScalar,
  MathAst,
  MathVariableNameSchema,
} from "@repo/math/schema/ast";
import { Schema } from "effect";

function literalValues<const Values extends readonly [string, ...string[]]>(
  ...values: Values
) {
  return values;
}

export const COORDINATE_AXIS_VALUES = literalValues("x", "y", "z");

/** Schema-owned coordinate axes used by renderer-owned surfaces. */
export const CoordinateAxisSchema = Schema.Literal(...COORDINATE_AXIS_VALUES);

export type CoordinateAxis = Schema.Schema.Type<typeof CoordinateAxisSchema>;

export const COORDINATE_PRIMITIVE_KIND_VALUES = literalValues(
  "point",
  "vector",
  "segment",
  "ray",
  "line",
  "plane",
  "polygon",
  "cuboid",
  "sphere",
  "parametric-curve",
  "function-surface",
  "parametric-surface"
);

/** Schema-owned primitive family supported by coordinate learning artifacts. */
export const CoordinatePrimitiveKindSchema = Schema.Literal(
  ...COORDINATE_PRIMITIVE_KIND_VALUES
);

export type CoordinatePrimitiveKind = Schema.Schema.Type<
  typeof CoordinatePrimitiveKindSchema
>;

/** Maximum stable id length accepted for one coordinate primitive. */
export const MAX_COORDINATE_PRIMITIVE_ID_LENGTH = 180;

const PrimitiveIdSchema = Schema.NonEmptyString.pipe(
  Schema.pattern(/\S/),
  Schema.maxLength(MAX_COORDINATE_PRIMITIVE_ID_LENGTH)
).annotations({
  description: "Bounded nonblank primitive id inside one coordinate artifact.",
});

const SampleCountSchema = Schema.Number.pipe(
  Schema.int(),
  Schema.between(2, 512)
).annotations({
  description: "Bounded deterministic sample budget for renderer-owned meshes.",
});

/** Maximum exact vertices accepted for one polygon primitive. */
export const MAX_POLYGON_VERTICES = 32;

/** Maximum exclusion predicates accepted on one scalar function primitive. */
export const MAX_FUNCTION_EXCLUSIONS = 16;

/** Maximum domains accepted on one function primitive. */
export const MAX_FUNCTION_DOMAINS = 3;

const commonPrimitiveFields = {
  id: PrimitiveIdSchema,
  label: Schema.optional(Schema.NonEmptyString),
};

/** Exact domain interval for one symbolic function variable. */
export class FunctionDomain extends Schema.Class<FunctionDomain>(
  "FunctionDomain"
)({
  closedMax: Schema.Boolean,
  closedMin: Schema.Boolean,
  max: ExactScalar,
  min: ExactScalar,
  variable: MathVariableNameSchema,
}) {}

/** Renderer-owned sampling budget for symbolic coordinate primitives. */
export class RenderSamplingPolicy extends Schema.Class<RenderSamplingPolicy>(
  "RenderSamplingPolicy"
)({
  curveSamples: SampleCountSchema,
  surfaceCells: SampleCountSchema,
}) {}

/** Canonical scalar function contract evaluated by CAS before rendering. */
export class CanonicalFunctionSpec extends Schema.Class<CanonicalFunctionSpec>(
  "CanonicalFunctionSpec"
)({
  ast: MathAst,
  domain: Schema.Array(FunctionDomain).pipe(
    Schema.minItems(1),
    Schema.maxItems(MAX_FUNCTION_DOMAINS),
    Schema.mutable
  ),
  exclusions: Schema.optional(
    Schema.Array(MathAst).pipe(
      Schema.maxItems(MAX_FUNCTION_EXCLUSIONS),
      Schema.mutable
    )
  ),
  verifiedBy: Schema.optional(Schema.NonEmptyString),
}) {}

/** Canonical vector function contract for curves and parametric surfaces. */
export class CanonicalVectorFunctionSpec extends Schema.Class<CanonicalVectorFunctionSpec>(
  "CanonicalVectorFunctionSpec"
)({
  domain: Schema.Array(FunctionDomain).pipe(
    Schema.minItems(1),
    Schema.maxItems(MAX_FUNCTION_DOMAINS),
    Schema.mutable
  ),
  x: MathAst,
  y: MathAst,
  z: MathAst,
}) {}

const PointPrimitiveSchema = Schema.Struct({
  ...commonPrimitiveFields,
  kind: Schema.Literal("point"),
  point: ExactPoint3,
}).pipe(Schema.mutable);

const VectorPrimitiveSchema = Schema.Struct({
  ...commonPrimitiveFields,
  kind: Schema.Literal("vector"),
  tail: Schema.optional(ExactPoint3),
  vector: ExactPoint3,
}).pipe(Schema.mutable);

const SegmentPrimitiveSchema = Schema.Struct({
  ...commonPrimitiveFields,
  end: ExactPoint3,
  kind: Schema.Literal("segment"),
  start: ExactPoint3,
}).pipe(Schema.mutable);

const RayPrimitiveSchema = Schema.Struct({
  ...commonPrimitiveFields,
  direction: ExactPoint3,
  kind: Schema.Literal("ray"),
  origin: ExactPoint3,
}).pipe(Schema.mutable);

const LinePrimitiveSchema = Schema.Struct({
  ...commonPrimitiveFields,
  direction: ExactPoint3,
  kind: Schema.Literal("line"),
  point: ExactPoint3,
}).pipe(Schema.mutable);

const PlanePrimitiveSchema = Schema.Struct({
  ...commonPrimitiveFields,
  equation: CanonicalFunctionSpec,
  kind: Schema.Literal("plane"),
  normal: ExactPoint3,
  point: ExactPoint3,
}).pipe(Schema.mutable);

const PolygonPrimitiveSchema = Schema.Struct({
  ...commonPrimitiveFields,
  kind: Schema.Literal("polygon"),
  vertices: Schema.Array(ExactPoint3).pipe(
    Schema.minItems(3),
    Schema.maxItems(MAX_POLYGON_VERTICES),
    Schema.mutable
  ),
}).pipe(Schema.mutable);

const CuboidPrimitiveSchema = Schema.Struct({
  ...commonPrimitiveFields,
  kind: Schema.Literal("cuboid"),
  max: ExactPoint3,
  min: ExactPoint3,
}).pipe(Schema.mutable);

const SpherePrimitiveSchema = Schema.Struct({
  ...commonPrimitiveFields,
  center: ExactPoint3,
  kind: Schema.Literal("sphere"),
  radius: ExactScalar,
}).pipe(Schema.mutable);

const ParametricCurvePrimitiveSchema = Schema.Struct({
  ...commonPrimitiveFields,
  function: CanonicalVectorFunctionSpec,
  kind: Schema.Literal("parametric-curve"),
}).pipe(Schema.mutable);

const FunctionSurfacePrimitiveSchema = Schema.Struct({
  ...commonPrimitiveFields,
  function: CanonicalFunctionSpec,
  kind: Schema.Literal("function-surface"),
  outputAxis: CoordinateAxisSchema,
}).pipe(Schema.mutable);

const ParametricSurfacePrimitiveSchema = Schema.Struct({
  ...commonPrimitiveFields,
  function: CanonicalVectorFunctionSpec,
  kind: Schema.Literal("parametric-surface"),
}).pipe(Schema.mutable);

/** One deterministic coordinate primitive owned by a learning artifact. */
export const CoordinatePrimitiveSchema = Schema.Union(
  PointPrimitiveSchema,
  VectorPrimitiveSchema,
  SegmentPrimitiveSchema,
  RayPrimitiveSchema,
  LinePrimitiveSchema,
  PlanePrimitiveSchema,
  PolygonPrimitiveSchema,
  CuboidPrimitiveSchema,
  SpherePrimitiveSchema,
  ParametricCurvePrimitiveSchema,
  FunctionSurfacePrimitiveSchema,
  ParametricSurfacePrimitiveSchema
).annotations({
  description:
    "Symbolic coordinate primitive. Renderers may sample it, but stored truth stays deterministic.",
});

export type CoordinatePrimitive = Schema.Schema.Type<
  typeof CoordinatePrimitiveSchema
>;

/** Reads every MathAst embedded in coordinate primitives for validation. */
export function readCoordinatePrimitiveMathAsts(
  primitives: readonly CoordinatePrimitive[]
) {
  const asts: MathAst[] = [];

  for (const primitive of primitives) {
    if (primitive.kind === "plane") {
      asts.push(...readFunctionMathAsts(primitive.equation));
      continue;
    }

    if (primitive.kind === "function-surface") {
      asts.push(...readFunctionMathAsts(primitive.function));
      continue;
    }

    if (primitive.kind === "parametric-curve") {
      asts.push(
        primitive.function.x,
        primitive.function.y,
        primitive.function.z
      );
      continue;
    }

    if (primitive.kind === "parametric-surface") {
      asts.push(
        primitive.function.x,
        primitive.function.y,
        primitive.function.z
      );
    }
  }

  return asts;
}

function readFunctionMathAsts(functionSpec: CanonicalFunctionSpec) {
  return functionSpec.exclusions
    ? [functionSpec.ast, ...functionSpec.exclusions]
    : [functionSpec.ast];
}
