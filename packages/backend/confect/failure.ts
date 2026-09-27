import { ConvexError } from "convex/values";
import { Option, Predicate, Schema, SchemaTransformation } from "effect";

const FailureData = Schema.Struct({
  code: Schema.String,
  message: Schema.String,
});
const TaggedFailure = Schema.Struct({
  _tag: Schema.String,
  ...FailureData.fields,
});

/** Shared transport fields carried by domain-owned tagged errors. */
export type ConvexTaggedError = typeof TaggedFailure.Type;

/** Reads the stable code and message from one typed Convex error payload. */
export function readConvexErrorData(error: unknown) {
  const tagged = Schema.decodeUnknownOption(TaggedFailure)(error);
  const data =
    error instanceof ConvexError ? error.data : Option.getOrUndefined(tagged);
  return Option.getOrNull(Schema.decodeUnknownOption(FailureData)(data));
}
/** Converts an unknown thrown value into a stable message for tagged errors. */
export function getUnknownErrorMessage(error: unknown) {
  if (Predicate.isError(error)) {
    return error.message;
  }
  return String(error);
}

/** Encodes only public fields and restores the domain error class on decode. */
export function failureWire<
  E extends ConvexTaggedError,
  C extends Schema.Codec<E["code"], string>,
  M extends Schema.Codec<E["message"], string>,
>(
  schema: Schema.Codec<E, unknown> & {
    readonly fields: { readonly code: C; readonly message: M };
    readonly make: (fields: {
      readonly code: C["Type"];
      readonly message: M["Type"];
    }) => E;
  }
) {
  return Schema.Struct({
    code: schema.fields.code,
    message: schema.fields.message,
  }).pipe(
    Schema.decodeTo(
      Schema.toType(schema),
      SchemaTransformation.transform({
        decode: (fields) => schema.make(fields),
        encode: ({ code, message }) => ({ code, message }),
      })
    )
  );
}
