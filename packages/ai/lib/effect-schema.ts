import { asSchema, jsonSchema } from "ai";
import { type JsonSchema, Schema } from "effect";

/** Converts an Effect schema into an AI SDK schema with Effect validation. */
export const createEffectSchema = <A, I>(
  schema: Schema.Codec<A, I, never, never>,
  modelSchema?: JsonSchema.JsonSchema
) => {
  const standardSchema = Schema.toStandardSchemaV1(
    Schema.toStandardJSONSchemaV1(schema)
  );
  const aiSchema = asSchema(standardSchema);
  if (modelSchema === undefined) {
    return aiSchema;
  }
  return jsonSchema<A>(modelSchema, { validate: aiSchema.validate });
};
