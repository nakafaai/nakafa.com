import { MathCopyKeySchema } from "@repo/math/schema/copy";
import { MathWorkResult } from "@repo/math/schema/work";
import { Schema } from "effect";

/** Encoded MathWorkResult schema used for serializable UI data parts. */
const MathWorkResultDataSchema = Schema.encodedSchema(MathWorkResult);

/** Minimal math request context streamed while work is loading or failed. */
const MathDataInputSchema = Schema.Struct({
  givens: Schema.Array(Schema.NonEmptyString).pipe(Schema.mutable),
  objective: Schema.NonEmptyString,
  request: Schema.NonEmptyString,
}).pipe(Schema.mutable);

/** Streaming state emitted before MathReasoning returns a result. */
const MathLoadingDataSchema = Schema.Struct({
  input: MathDataInputSchema,
  status: Schema.Literal("loading"),
}).pipe(Schema.mutable);

/** Streaming state emitted after MathReasoning returns normalized evidence. */
const MathDoneDataSchema = Schema.Struct({
  result: MathWorkResultDataSchema,
  status: Schema.Literal("done"),
}).pipe(Schema.mutable);

/** Streaming state emitted when MathReasoning cannot produce evidence. */
const MathErrorDataSchema = Schema.Struct({
  errorKey: MathCopyKeySchema,
  input: MathDataInputSchema,
  status: Schema.Literal("error"),
}).pipe(Schema.mutable);

/** MathWork data part streamed to the chat UI. */
export const MathDataSchema = Schema.Union(
  MathLoadingDataSchema,
  MathDoneDataSchema,
  MathErrorDataSchema
).annotations({
  description:
    "Compact MathWork UI data part; durable evidence is stored in normalized rows.",
});

export type MathData = Schema.Schema.Type<typeof MathDataSchema>;
