import { MathOperationSchema } from "@repo/math/schema/operations";
import {
  matrixSchema,
  pointArraySchema,
  stringArraySchema,
} from "@repo/math/schema/shared";
import { probabilityParametersSchema } from "@repo/math/schema/tool/probability";
import { Schema } from "effect";

export const MathRequestSchema = Schema.Struct({
  distribution: Schema.optional(Schema.String),
  expression: Schema.optional(Schema.String),
  expressions: Schema.optional(stringArraySchema),
  k: Schema.optional(Schema.String),
  kind: Schema.Literal("math"),
  inclusive: Schema.optional(Schema.Boolean),
  left: Schema.optional(Schema.String),
  lower: Schema.optional(Schema.String),
  lowerInclusive: Schema.optional(Schema.Boolean),
  matrix: Schema.optional(matrixSchema),
  modulus: Schema.optional(Schema.String),
  n: Schema.optional(Schema.String),
  operation: MathOperationSchema,
  order: Schema.optional(Schema.NonNegativeInt),
  parameters: Schema.optional(probabilityParametersSchema),
  point: Schema.optional(Schema.String),
  points: Schema.optional(pointArraySchema),
  right: Schema.optional(Schema.String),
  right_matrix: Schema.optional(matrixSchema),
  upper: Schema.optional(Schema.String),
  upperInclusive: Schema.optional(Schema.Boolean),
  values: Schema.optional(stringArraySchema),
  variable: Schema.optional(Schema.String),
  variables: Schema.optional(stringArraySchema),
  vector: Schema.optional(stringArraySchema),
}).pipe(Schema.mutable);

export type MathRequest = Schema.Schema.Type<typeof MathRequestSchema>;
