import { Predicate, Schema, SchemaTransformation } from "effect";

const FailureData = Schema.Struct({
  code: Schema.String,
  message: Schema.String,
});
const TaggedFailure = Schema.Struct({
  _tag: Schema.String,
  ...FailureData.fields,
});

/** Shared transport fields carried by domain-owned tagged errors. */
type PublicFailure = typeof TaggedFailure.Type;

/** Converts an unknown thrown value into a stable message for tagged errors. */
export function getUnknownErrorMessage(error: unknown) {
  if (Predicate.isError(error)) {
    return error.message;
  }
  return String(error);
}

/** Encodes only public fields and restores the domain error class on decode. */
export function publicFailure<
  E extends PublicFailure,
  C extends Schema.Codec<E["code"], string>,
  M extends Schema.Codec<E["message"], string>,
>(
  schema: Schema.Codec<E, unknown> & {
    readonly fields: {
      readonly _tag: Schema.tag<E["_tag"]>;
      readonly code: C;
      readonly message: M;
    };
    readonly make: (fields: {
      readonly code: C["Type"];
      readonly message: M["Type"];
    }) => E;
  }
) {
  return Schema.Struct({
    _tag: schema.fields._tag.schema,
    code: schema.fields.code,
    message: schema.fields.message,
  }).pipe(
    Schema.decodeTo(
      Schema.toType(schema),
      SchemaTransformation.transform({
        decode: (fields) => schema.make(fields),
        encode: ({ _tag, code, message }) => ({
          _tag,
          code,
          message,
        }),
      })
    )
  );
}
