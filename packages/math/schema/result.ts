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

/**
 * The most rows one list of a result holds: its steps, its items or its
 * conditions. It is the size of the longest list the CAS takes in one request
 * (`MathValues` in apps/cas/cas/schema.py), so what the capability sends and
 * what it admits back are held to one bound.
 */
export const mathResultMaxRows = 128;

/** Whether no list of a result holds more than `mathResultMaxRows` rows. */
function listsFit(result: MathResult) {
  return (
    result.conditions.length <= mathResultMaxRows &&
    result.items.length <= mathResultMaxRows &&
    result.steps.length <= mathResultMaxRows
  );
}

/**
 * A result as the service admits it from the CAS: no list holds more than
 * `mathResultMaxRows` rows. A longer one is refused like any response that
 * breaks the contract, so the check ends as an unavailable one, and Nina is
 * told to recover. Only the response is held to this: a result already stored
 * keeps its lists whatever their length, and `MathResultSchema` reads it.
 */
export const MathCasResultSchema = MathResultSchema.check(
  Schema.makeFilter(listsFit, {
    message: `Expected no more than ${mathResultMaxRows} steps, items or conditions.`,
  })
);
