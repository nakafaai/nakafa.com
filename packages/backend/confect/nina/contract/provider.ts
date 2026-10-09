import {
  Array as Arr,
  JsonSchema,
  Predicate,
  Record as Rec,
  Result,
  Schema,
} from "effect";

/** Expected failure: an authored schema has no provider tool parameter form. */
export class ProviderToolSchemaError extends Schema.TaggedError<ProviderToolSchemaError>()(
  "ProviderToolSchemaError",
  {
    message: Schema.String,
    reason: Schema.Literals([
      "unionBranchNotObject",
      "unsupportedProperty",
      "notObjectOrUnion",
    ]),
  }
) {}

const ObjectJsonSchemaSchema = Schema.Struct({
  properties: Schema.Record(Schema.String, Schema.Unknown),
  required: Schema.Array(Schema.String),
  type: Schema.Literal("object"),
});

type ObjectJsonSchema = JsonSchema.JsonSchema &
  typeof ObjectJsonSchemaSchema.Type;

const ArrayJsonSchemaSchema = Schema.Struct({
  maxItems: Schema.optionalKey(Schema.Finite),
  minItems: Schema.optionalKey(Schema.Finite),
  type: Schema.Literal("array"),
});

type ArrayJsonSchema = JsonSchema.JsonSchema &
  typeof ArrayJsonSchemaSchema.Type;

const ArrayMetadataSchema = Schema.Struct({
  description: Schema.UndefinedOr(Schema.String),
  maxItems: Schema.UndefinedOr(Schema.Finite),
  minItems: Schema.UndefinedOr(Schema.Finite),
});

type ArrayMetadata = typeof ArrayMetadataSchema.Type;

/** Narrows generated JSON Schema to object-shaped function parameters. */
function isObjectSchema(schema: unknown): schema is ObjectJsonSchema {
  if (!Predicate.isReadonlyObject(schema) || schema.type !== "object") {
    return false;
  }
  if (!Predicate.isReadonlyObject(schema.properties)) {
    return false;
  }
  return Arr.isArray(schema.required);
}

/** Narrows generated JSON Schema to array-shaped properties. */
function isArraySchema(schema: unknown): schema is ArrayJsonSchema {
  return Predicate.isReadonlyObject(schema) && schema.type === "array";
}

/** Requires every top-level Effect union branch to define object parameters. */
function objectVariants(
  schema: JsonSchema.JsonSchema
): Result.Result<readonly ObjectJsonSchema[], ProviderToolSchemaError> {
  if (!Arr.isArray(schema.anyOf)) {
    return Result.succeed([]);
  }
  return Result.all(
    Arr.map(schema.anyOf, (variant) =>
      isObjectSchema(variant)
        ? Result.succeed(variant)
        : Result.fail(
            new ProviderToolSchemaError({
              message:
                "Provider-compatible tool schema unions require every branch to be an object.",
              reason: "unionBranchNotObject",
            })
          )
    )
  );
}

/** Preserves declared enum order while removing duplicate enum values. */
function mergeEnumValues(left: readonly unknown[], right: readonly unknown[]) {
  return Arr.dedupe([...left, ...right]);
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

  if (!Arr.isArray(schema.allOf)) {
    return { description, maxItems, minItems };
  }

  for (const constraint of schema.allOf) {
    if (!Predicate.isReadonlyObject(constraint)) {
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
}

/** Merges shared property metadata from multiple object union branches. */
function mergePropertySchema(
  left: JsonSchema.JsonSchema,
  right: JsonSchema.JsonSchema
): JsonSchema.JsonSchema {
  const description = mergeDescription(left.description, right.description);
  if (Arr.isArray(left.enum) && Arr.isArray(right.enum)) {
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
function requirePropertySchema(
  value: unknown,
  name: string
): Result.Result<JsonSchema.JsonSchema, ProviderToolSchemaError> {
  if (Predicate.isReadonlyObject(value)) {
    return Result.succeed(value);
  }
  return Result.fail(
    new ProviderToolSchemaError({
      message: `Effect generated an unsupported schema for property ${name}.`,
      reason: "unsupportedProperty",
    })
  );
}

/** Reads every property of every object union variant in declaration order. */
function readVariantProperties(variants: readonly ObjectJsonSchema[]) {
  return Result.all(
    Arr.flatMap(variants, (variant) =>
      Arr.map(Rec.toEntries(variant.properties), ([name, value]) =>
        Result.map(requirePropertySchema(value, name), (property) => ({
          name,
          property,
        }))
      )
    )
  );
}

/** Builds one optional-property map from object union variants. */
function mergeVariantProperties(variants: readonly ObjectJsonSchema[]) {
  return Result.map(readVariantProperties(variants), (entries) => {
    const properties: Record<string, JsonSchema.JsonSchema> = {};
    for (const { name, property } of entries) {
      const existing = properties[name];
      properties[name] = existing
        ? mergePropertySchema(existing, property)
        : property;
    }
    return properties;
  });
}

/** Keeps schema metadata while removing provider-hostile top-level unions. */
function withoutTopLevelAnyOf(schema: JsonSchema.JsonSchema) {
  const { anyOf: _anyOf, ...metadata } = schema;
  return metadata;
}

/** Emits the exact Effect schema document as AI SDK Draft-07 JSON Schema. */
function toDraft07Document(schema: Schema.Constraint) {
  return JsonSchema.toDocumentDraft07(
    Schema.toJsonSchemaDocument(schema, { referencePolicy: () => undefined })
  );
}

/** Attaches local definitions to one provider-facing Draft-07 schema. */
function withDefinitions(document: JsonSchema.Document<"draft-07">) {
  if (Rec.keys(document.definitions).length === 0) {
    return document.schema;
  }
  return {
    ...document.schema,
    definitions: document.definitions,
  };
}

/**
 * Builds an object-shaped schema for providers that reject top-level unions.
 * This synchronous AI SDK construction boundary accepts authored schemas only.
 * Unsupported schema shapes return a ProviderToolSchemaError, and authored
 * callers unwrap it at module load. Runtime values still use the original
 * Effect validator. Named nonrecursive fields stay inline so union merging does
 * not depend on JSON Schema reference-resolution helpers.
 */
export const providerCompatibleObjectSchema = <A, I>(
  schema: Schema.Codec<A, I, never, never>
): Result.Result<JsonSchema.JsonSchema, ProviderToolSchemaError> => {
  const document = toDraft07Document(schema);
  const modelSchema = withDefinitions(document);
  if (isObjectSchema(modelSchema)) {
    return Result.succeed(modelSchema);
  }
  return Result.flatMap(objectVariants(modelSchema), (variants) => {
    if (variants.length === 0) {
      return Result.fail(
        new ProviderToolSchemaError({
          message:
            "Provider-compatible tool schemas require an object or object union.",
          reason: "notObjectOrUnion",
        })
      );
    }
    return Result.map(mergeVariantProperties(variants), (properties) => ({
      ...withoutTopLevelAnyOf(modelSchema),
      properties,
      required: [],
      type: "object",
    }));
  });
};
