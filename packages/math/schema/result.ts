import { MathOperationSchema } from "@repo/math/schema/operations";
import { MathRequestSchema } from "@repo/math/schema/request";
import {
  MathExpressionSchema,
  MathItemSchema,
  MathStepSchema,
} from "@repo/math/schema/shared";
import {
  MathStatusSchema,
  MathStepStatusSchema,
} from "@repo/math/schema/status";
import { Schema } from "effect";

export const MathResultSchema = Schema.Struct({
  conditions: Schema.Array(MathExpressionSchema).pipe(Schema.mutable),
  input: MathRequestSchema,
  items: Schema.Array(MathItemSchema).pipe(Schema.mutable),
  kind: MathOperationSchema,
  operation: MathOperationSchema,
  primary: MathExpressionSchema,
  reason: Schema.String,
  secondary: Schema.optional(MathExpressionSchema),
  stepStatus: MathStepStatusSchema,
  steps: Schema.Array(MathStepSchema).pipe(Schema.mutable),
  status: MathStatusSchema,
}).pipe(Schema.mutable);

export type MathResult = Schema.Schema.Type<typeof MathResultSchema>;
