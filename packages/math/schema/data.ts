import { MathCopyKeySchema } from "@repo/math/schema/copy";
import { MathWorkResult } from "@repo/math/schema/work";
import { Schema } from "effect";

/** Encoded MathWorkResult schema used for serializable MathReasoning data. */
export const MathReasoningResultDataSchema =
  Schema.encodedSchema(MathWorkResult);

/** Minimal MathReasoning request context streamed while work is loading or failed. */
export const MathReasoningInputDataSchema = Schema.Struct({
  givens: Schema.Array(Schema.NonEmptyString).pipe(Schema.mutable),
  objective: Schema.NonEmptyString,
  request: Schema.NonEmptyString,
  requirements: Schema.optionalWith(
    Schema.Array(Schema.NonEmptyString).pipe(Schema.mutable),
    { default: () => [] }
  ),
}).pipe(Schema.mutable);

/** Streaming state emitted before MathReasoning returns a result. */
export const MathReasoningLoadingDataSchema = Schema.Struct({
  input: MathReasoningInputDataSchema,
  status: Schema.Literal("loading"),
}).pipe(Schema.mutable);

/** Streaming state emitted after MathReasoning returns normalized evidence. */
export const MathReasoningDoneDataSchema = Schema.Struct({
  result: MathReasoningResultDataSchema,
  status: Schema.Literal("done"),
}).pipe(Schema.mutable);

/** Streaming state emitted when MathReasoning cannot produce evidence. */
export const MathReasoningErrorDataSchema = Schema.Struct({
  errorKey: MathCopyKeySchema,
  input: MathReasoningInputDataSchema,
  status: Schema.Literal("error"),
}).pipe(Schema.mutable);

/** Deterministic MathReasoning lane streamed to the chat UI. */
export const MathReasoningDataSchema = Schema.Union(
  MathReasoningLoadingDataSchema,
  MathReasoningDoneDataSchema,
  MathReasoningErrorDataSchema
).annotations({
  description:
    "Compact deterministic MathReasoning lane; durable evidence is stored in normalized rows.",
});

export type MathReasoningData = Schema.Schema.Type<
  typeof MathReasoningDataSchema
>;
