import { MathOperationSchema } from "@repo/math/schema/operations";
import {
  matrixSchema,
  pointArraySchema,
  stringArraySchema,
} from "@repo/math/schema/shared";
import { probabilityParametersSchema } from "@repo/math/schema/tool/probability";
import { Schema, Struct } from "effect";
export const MathRequestSchema = Schema.Struct({
  distribution: Schema.optionalKey(Schema.String),
  expression: Schema.optionalKey(Schema.String),
  expressions: Schema.optionalKey(stringArraySchema),
  k: Schema.optionalKey(Schema.String),
  kind: Schema.Literal("math"),
  inclusive: Schema.optionalKey(Schema.Boolean),
  left: Schema.optionalKey(Schema.String),
  lower: Schema.optionalKey(Schema.String),
  lowerInclusive: Schema.optionalKey(Schema.Boolean),
  matrix: Schema.optionalKey(matrixSchema),
  modulus: Schema.optionalKey(Schema.String),
  n: Schema.optionalKey(Schema.String),
  operation: MathOperationSchema,
  order: Schema.optionalKey(
    Schema.Finite.check(Schema.isInt()).check(Schema.isGreaterThanOrEqualTo(0))
  ),
  parameters: Schema.optionalKey(probabilityParametersSchema),
  point: Schema.optionalKey(Schema.String),
  points: Schema.optionalKey(pointArraySchema),
  right: Schema.optionalKey(Schema.String),
  right_matrix: Schema.optionalKey(matrixSchema),
  upper: Schema.optionalKey(Schema.String),
  upperInclusive: Schema.optionalKey(Schema.Boolean),
  values: Schema.optionalKey(stringArraySchema),
  variable: Schema.optionalKey(Schema.String),
  variables: Schema.optionalKey(stringArraySchema),
  vector: Schema.optionalKey(stringArraySchema),
})
  .pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)))
  .annotate({
    description:
      "Canonical request sent to the deterministic CAS math service.",
  });
export type MathRequest = Schema.Schema.Type<typeof MathRequestSchema>;
