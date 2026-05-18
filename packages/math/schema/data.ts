import { MathOperationSchema } from "@repo/math/schema/operations";
import { MathRequestSchema } from "@repo/math/schema/request";
import { MathResultSchema } from "@repo/math/schema/result";
import { MathStatusSchema } from "@repo/math/schema/status";
import { Schema } from "effect";

const mathLoadingDataSchema = Schema.Struct({
  input: MathRequestSchema,
  kind: MathOperationSchema,
  status: Schema.Literal("loading"),
}).pipe(Schema.mutable);

const mathDoneDataSchema = Schema.Struct({
  input: MathRequestSchema,
  kind: MathOperationSchema,
  result: MathResultSchema,
  status: MathStatusSchema,
  summary: Schema.String,
}).pipe(Schema.mutable);

const mathErrorDataSchema = Schema.Struct({
  error: Schema.String,
  input: MathRequestSchema,
  kind: MathOperationSchema,
  status: Schema.Literal("error"),
}).pipe(Schema.mutable);

export const MathDataSchema = Schema.Union(
  mathLoadingDataSchema,
  mathDoneDataSchema,
  mathErrorDataSchema
).annotations({
  description: "Math evidence data part streamed to the chat UI.",
});

export type MathData = Schema.Schema.Type<typeof MathDataSchema>;
