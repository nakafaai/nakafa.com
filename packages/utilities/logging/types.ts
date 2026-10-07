import { Schema } from "effect";

const LogContextSchema = Schema.Record(Schema.String, Schema.Unknown);

/** Structured metadata attached to Effect logs as annotations. */
export type LogContext = typeof LogContextSchema.Type;
