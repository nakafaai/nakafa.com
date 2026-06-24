import { Option, Schema } from "effect";

export const UnknownMessageCauseSchema = Schema.Union(
  Schema.String,
  Schema.Struct({
    message: Schema.String,
  }).pipe(Schema.mutable)
);

export type UnknownMessageCause = Schema.Schema.Type<
  typeof UnknownMessageCauseSchema
>;

/**
 * Extracts a message from unknown thrown values using a schema-owned shape.
 *
 * Callers own the fallback because fallback copy is domain-specific.
 */
export function messageFromUnknown(error: unknown, fallback: string) {
  return Schema.decodeUnknownOption(UnknownMessageCauseSchema)(error).pipe(
    Option.match({
      onNone: () => fallback,
      onSome: messageFromCause,
    })
  );
}

/** Reads the normalized message from a decoded thrown-value shape. */
function messageFromCause(cause: UnknownMessageCause) {
  if (typeof cause === "string") {
    return cause;
  }

  return cause.message;
}
