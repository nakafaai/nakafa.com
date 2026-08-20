import { jsonSchema } from "ai";
import { JsonSchema, Result, Schema } from "effect";

interface ObjectJsonSchema extends JsonSchema.JsonSchema {
  readonly properties: Readonly<Record<string, unknown>>;
  readonly required: readonly string[];
  readonly type: "object";
}

interface ArrayJsonSchema extends JsonSchema.JsonSchema {
  readonly maxItems?: number;
  readonly minItems?: number;
  readonly type: "array";
}

interface ArrayMetadata {
  readonly description?: string;
  readonly maxItems?: number;
  readonly minItems?: number;
}

/** Narrows an unknown value to one JSON Schema object. */
function isJsonSchema(value: unknown): value is JsonSchema.JsonSchema {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Narrows generated JSON Schema to object-shaped function parameters. */
function isObjectSchema(schema: unknown): schema is ObjectJsonSchema {
  if (!isJsonSchema(schema) || schema.type !== "object") {
    return false;
  }
  if (!isJsonSchema(schema.properties)) {
    return false;
  }
  return Array.isArray(schema.required);
}

/** Narrows generated JSON Schema to array-shaped properties. */
function isArraySchema(schema: unknown): schema is ArrayJsonSchema {
  return isJsonSchema(schema) && schema.type === "array";
}

/** Returns object branches from a top-level Effect union schema. */
function objectVariants(schema: JsonSchema.JsonSchema) {
  if (!Array.isArray(schema.anyOf)) {
    return [];
  }
  return schema.anyOf.filter(isObjectSchema);
}

/** Preserves declared enum order while removing duplicate enum values. */
function mergeEnumValues(left: readonly unknown[], right: readonly unknown[]) {
  return [...new Set([...left, ...right])];
}

/** Joins branch descriptions so provider-facing unions keep all instructions. */
function mergeDescription(left: unknown, right: unknown) {
  const leftDescription = typeof left === "string" ? left : undefined;
  const rightDescription = typeof right === "string" ? right : undefined;
  if (!leftDescription) {
    return rightDescription;
  }
  if (!rightDescription || leftDescription === rightDescription) {
    return leftDescription;
  }
  return `${leftDescription} ${rightDescription}`;
}

/** Reads array checks emitted through nested JSON Schema intersections. */
function readArrayMetadata(schema: JsonSchema.JsonSchema): ArrayMetadata {
  let description =
    typeof schema.description === "string" ? schema.description : undefined;
  let maxItems =
    typeof schema.maxItems === "number" ? schema.maxItems : undefined;
  let minItems =
    typeof schema.minItems === "number" ? schema.minItems : undefined;

  if (!Array.isArray(schema.allOf)) {
    return { description, maxItems, minItems };
  }

  for (const constraint of schema.allOf) {
    if (!isJsonSchema(constraint)) {
      continue;
    }
    const nested = readArrayMetadata(constraint);
    description = mergeDescription(description, nested.description);
    if (typeof nested.minItems === "number") {
      minItems = Math.max(minItems ?? 0, nested.minItems);
    }
    if (typeof nested.maxItems === "number") {
      maxItems = Math.min(
        maxItems ?? Number.POSITIVE_INFINITY,
        nested.maxItems
      );
    }
  }

  return { description, maxItems, minItems };
}

/** Relaxes shared array bounds enough to represent every union branch. */
function mergeArrayBounds(left: ArrayMetadata, right: ArrayMetadata) {
  const bounds: { maxItems?: number; minItems?: number } = {};
  if (typeof left.minItems === "number" || typeof right.minItems === "number") {
    bounds.minItems = Math.min(left.minItems ?? 0, right.minItems ?? 0);
  }
  if (typeof left.maxItems === "number" && typeof right.maxItems === "number") {
    bounds.maxItems = Math.max(left.maxItems, right.maxItems);
  }
  return bounds;
}

/** Preserves one branch-only maximum as model guidance after relaxing it. */
function describeDroppedArrayMaximum(
  left: ArrayMetadata,
  right: ArrayMetadata
) {
  if (typeof left.maxItems === "number" && right.maxItems === undefined) {
    return `an array of at most ${left.maxItems} item(s)`;
  }
  if (left.maxItems === undefined && typeof right.maxItems === "number") {
    return `an array of at most ${right.maxItems} item(s)`;
  }
  return;
}

/** Merges shared property metadata from multiple object union branches. */
function mergePropertySchema(
  left: JsonSchema.JsonSchema,
  right: JsonSchema.JsonSchema
): JsonSchema.JsonSchema {
  const description = mergeDescription(left.description, right.description);
  if (Array.isArray(left.enum) && Array.isArray(right.enum)) {
    return {
      ...right,
      ...(description ? { description } : {}),
      enum: mergeEnumValues(left.enum, right.enum),
    };
  }
  if (isArraySchema(left) && isArraySchema(right)) {
    const leftMetadata = readArrayMetadata(left);
    const rightMetadata = readArrayMetadata(right);
    const description =
      mergeDescription(leftMetadata.description, rightMetadata.description) ??
      describeDroppedArrayMaximum(leftMetadata, rightMetadata);
    const {
      allOf: _allOf,
      description: _description,
      maxItems: _maxItems,
      minItems: _minItems,
      title: _title,
      ...arraySchema
    } = right;
    return {
      ...arraySchema,
      ...mergeArrayBounds(leftMetadata, rightMetadata),
      ...(description ? { description } : {}),
    };
  }
  return {
    ...right,
    ...(description ? { description } : {}),
  };
}

/** Returns a generated property schema or fails on an unsupported boolean form. */
function requirePropertySchema(value: unknown, name: string) {
  if (isJsonSchema(value)) {
    return value;
  }
  throw new Error(
    `Effect generated an unsupported schema for property ${name}.`
  );
}

/** Resolves one generated local reference before merging union properties. */
function resolvePropertySchema(
  value: unknown,
  name: string,
  definitions: JsonSchema.Definitions
) {
  const property = requirePropertySchema(value, name);
  if (typeof property.$ref !== "string") {
    return property;
  }
  return requirePropertySchema(
    JsonSchema.resolve$ref(property.$ref, definitions),
    name
  );
}

/** Builds one optional-property map from object union variants. */
function mergeVariantProperties(
  variants: readonly ObjectJsonSchema[],
  definitions: JsonSchema.Definitions
) {
  const properties: Record<string, JsonSchema.JsonSchema> = {};
  for (const variant of variants) {
    for (const [name, value] of Object.entries(variant.properties)) {
      const property = resolvePropertySchema(value, name, definitions);
      const existing = properties[name];
      properties[name] = existing
        ? mergePropertySchema(existing, property)
        : property;
    }
  }
  return properties;
}

/** Keeps schema metadata while removing provider-hostile top-level unions. */
function withoutTopLevelAnyOf(schema: JsonSchema.JsonSchema) {
  const { anyOf: _anyOf, ...metadata } = schema;
  return metadata;
}

/** Emits the exact Effect schema document as AI SDK Draft-07 JSON Schema. */
function toDraft07Document(schema: Schema.Constraint) {
  return JsonSchema.toDocumentDraft07(Schema.toJsonSchemaDocument(schema));
}

/** Attaches local definitions to one provider-facing Draft-07 schema. */
function withDefinitions(document: JsonSchema.Document<"draft-07">) {
  if (Object.keys(document.definitions).length === 0) {
    return document.schema;
  }
  return {
    ...document.schema,
    definitions: document.definitions,
  };
}

/** Emits the exact Effect schema as AI SDK compatible Draft-07 JSON Schema. */
function toDraft07Schema(schema: Schema.Constraint) {
  return withDefinitions(toDraft07Document(schema));
}

/**
 * Builds an object-shaped schema for providers that reject top-level unions.
 * Effect validation still uses the original schema.
 */
export const providerCompatibleObjectSchema = <A, I>(
  schema: Schema.Codec<A, I, never, never>
) => {
  const document = toDraft07Document(schema);
  const modelSchema = withDefinitions(document);
  if (isObjectSchema(modelSchema)) {
    return modelSchema;
  }
  const variants = objectVariants(modelSchema);
  if (variants.length === 0) {
    throw new Error(
      "Provider-compatible tool schemas require an object or object union."
    );
  }
  return {
    ...withoutTopLevelAnyOf(modelSchema),
    properties: mergeVariantProperties(variants, document.definitions),
    required: [],
    type: "object",
  };
};

/** Converts an Effect schema into an AI SDK schema with Effect validation. */
export const createEffectSchema = <A, I>(
  schema: Schema.Codec<A, I, never, never>,
  modelSchema = toDraft07Schema(schema)
) =>
  jsonSchema<A>(modelSchema, {
    validate: (value) => {
      const decoded = Schema.decodeUnknownResult(schema)(value);
      if (Result.isSuccess(decoded)) {
        return { success: true, value: decoded.success };
      }
      return {
        error: new Error(decoded.failure.message),
        success: false,
      };
    },
  });
