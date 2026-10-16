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
import { Schema, Struct } from "effect";
/**
 * A result of the CAS. Its lists have no row limit: the CAS bounds a whole
 * result by its size, 256 KiB of JSON, and refuses a larger one
 * (`MAX_RESPONSE_BYTES` in apps/cas/cas/compute.py). A result can therefore
 * hold more rows than a request may carry, and a view shows the first rows of
 * a list and the rest behind a button.
 */
export const MathResultSchema = Schema.Struct({
  conditions: Schema.Array(MathExpressionSchema).pipe(Schema.mutable),
  input: MathRequestSchema,
  items: Schema.Array(MathItemSchema).pipe(Schema.mutable),
  kind: MathOperationSchema,
  operation: MathOperationSchema,
  primary: MathExpressionSchema,
  reason: Schema.String,
  secondary: Schema.optionalKey(MathExpressionSchema),
  stepStatus: MathStepStatusSchema,
  steps: Schema.Array(MathStepSchema).pipe(Schema.mutable),
  status: MathStatusSchema,
})
  .pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)))
  .annotate({
    description: "Deterministic CAS math result returned to Nina and the UI.",
  });
export type MathResult = typeof MathResultSchema.Type;
