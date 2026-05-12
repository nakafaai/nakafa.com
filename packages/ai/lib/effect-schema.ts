import { jsonSchema } from "ai";
import { Either, JSONSchema, Schema } from "effect";

/** Narrows generated JSON Schema to object-shaped function parameters. */
function isObjectSchema(
  schema: object
): schema is JSONSchema.JsonSchema7Object {
  return (
    "type" in schema &&
    schema.type === "object" &&
    "properties" in schema &&
    "required" in schema
  );
}

/** Narrows generated JSON Schema to array-shaped properties. */
function isArraySchema(
  schema: JSONSchema.JsonSchema7
): schema is JSONSchema.JsonSchema7Array {
  return "type" in schema && schema.type === "array";
}

/** Returns object branches from a top-level Effect union schema. */
function objectVariants(schema: JSONSchema.JsonSchema7Root) {
  if (!("anyOf" in schema)) {
    return [];
  }

  return schema.anyOf.filter(isObjectSchema);
}

/** Preserves declared enum order while removing duplicate enum values. */
function mergeEnumValues(
  left: Array<string | number | boolean>,
  right: Array<string | number | boolean>
) {
  return [...new Set([...left, ...right])];
}

/** Joins branch descriptions so provider-facing unions keep all instructions. */
function mergeDescription(left?: string, right?: string) {
  if (!left) {
    return right;
  }

  if (!right || left === right) {
    return left;
  }

  return `${left} ${right}`;
}

/** Relaxes shared array bounds enough to represent every union branch. */
function mergeArrayBounds(
  left: JSONSchema.JsonSchema7Array,
  right: JSONSchema.JsonSchema7Array
) {
  const bounds: Partial<
    Pick<JSONSchema.JsonSchema7Array, "maxItems" | "minItems">
  > = {};

  if (typeof left.minItems === "number" || typeof right.minItems === "number") {
    bounds.minItems = Math.min(left.minItems ?? 0, right.minItems ?? 0);
  }

  if (typeof left.maxItems === "number" && typeof right.maxItems === "number") {
    bounds.maxItems = Math.max(left.maxItems, right.maxItems);
  }

  return bounds;
}

/** Merges shared property metadata from multiple object union branches. */
function mergePropertySchema(
  left: JSONSchema.JsonSchema7,
  right: JSONSchema.JsonSchema7
): JSONSchema.JsonSchema7 {
  const description = mergeDescription(left.description, right.description);

  if ("enum" in left && "enum" in right) {
    if (description) {
      return {
        ...right,
        description,
        enum: mergeEnumValues(left.enum, right.enum),
      };
    }

    return {
      ...right,
      enum: mergeEnumValues(left.enum, right.enum),
    };
  }

  if (isArraySchema(left) && isArraySchema(right)) {
    const {
      maxItems: _maxItems,
      minItems: _minItems,
      title: _title,
      ...arraySchema
    } = right;

    return {
      ...arraySchema,
      ...mergeArrayBounds(left, right),
      ...(description ? { description } : {}),
    };
  }

  if (description) {
    return {
      ...right,
      description,
    };
  }

  return right;
}

/** Builds one optional-property map from object union variants. */
function mergeVariantProperties(
  variants: readonly JSONSchema.JsonSchema7Object[]
) {
  const properties: Record<string, JSONSchema.JsonSchema7> = {};

  for (const variant of variants) {
    for (const [name, property] of Object.entries(variant.properties)) {
      const existing = properties[name];

      if (!existing) {
        properties[name] = property;
        continue;
      }

      properties[name] = mergePropertySchema(existing, property);
    }
  }

  return properties;
}

/** Keeps schema metadata while removing provider-hostile top-level unions. */
function withoutTopLevelAnyOf(schema: JSONSchema.JsonSchema7Root) {
  if ("anyOf" in schema) {
    const { anyOf: _anyOf, ...metadata } = schema;
    return metadata;
  }

  return schema;
}

/**
 * Builds an object-shaped schema for model providers that reject top-level
 * union tool parameters. Effect validation still uses the original schema.
 */
export const providerCompatibleObjectSchema = <A, I>(
  schema: Schema.Schema<A, I, never>
) => {
  const modelSchema = JSONSchema.make(schema);

  if (isObjectSchema(modelSchema)) {
    return modelSchema;
  }

  const variants = objectVariants(modelSchema);
  const properties = mergeVariantProperties(variants);

  return {
    ...withoutTopLevelAnyOf(modelSchema),
    properties,
    required: [],
    type: "object",
  } satisfies JSONSchema.JsonSchema7Root;
};

/**
 * Converts an Effect schema into an AI SDK schema.
 *
 * AI SDK 6 can consume JSON Schema for tool inputs and outputs. Effect's
 * StandardSchema bridge validates values, but Effect 3.21 does not expose the
 * `~standard.jsonSchema` field that this repo's installed AI SDK reads for
 * model-facing tool metadata.
 *
 * References:
 * - https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling
 * - https://effect.website/docs/schema/json-schema/
 */
export const createEffectSchema = <A, I>(
  schema: Schema.Schema<A, I, never>,
  modelSchema = JSONSchema.make(schema)
) =>
  jsonSchema<A>(modelSchema, {
    validate: (value) => {
      const decoded = Schema.decodeUnknownEither(schema)(value);

      if (Either.isRight(decoded)) {
        return { success: true, value: decoded.right };
      }

      return {
        error: new Error(decoded.left.message),
        success: false,
      };
    },
  });
