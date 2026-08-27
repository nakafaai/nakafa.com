import {
  NakafaApiHealthSchema,
  NakafaApiIndexSchema,
  NakafaProblemDetailsSchema,
} from "@repo/contents/_lib/agent/schema/api";
import {
  NakafaAgentQuranReferenceOptionsSchema,
  NakafaAgentQuranReferenceSchema,
} from "@repo/contents/_lib/agent/schema/quran";
import {
  NakafaAgentContentRefInputSchema,
  NakafaAgentMarkdownSchema,
} from "@repo/contents/_lib/agent/schema/read";
import {
  NakafaAgentSearchOptionsSchema,
  NakafaAgentSearchResultSchema,
} from "@repo/contents/_lib/agent/schema/search";
import {
  NakafaAgentTaxonomyOptionsSchema,
  NakafaAgentTaxonomySchema,
} from "@repo/contents/_lib/agent/schema/taxonomy";
import { Predicate, Schema } from "effect";

const LOCAL_DEFINITION_REFERENCE_PATTERN = /^#\/\$defs\/(.+)$/;

/** Converts an Effect schema into self-contained JSON Schema 2020-12. */
export function toOpenApiSchema(schema: Schema.Constraint) {
  const document = Schema.toJsonSchemaDocument(schema);
  return inlineDefinitions(document.schema, document.definitions, []);
}

/** Public response schemas generated from runtime contracts. */
export const OPENAPI_SCHEMAS = {
  ApiHealth: toOpenApiSchema(NakafaApiHealthSchema),
  ApiIndex: toOpenApiSchema(NakafaApiIndexSchema),
  Content: toOpenApiSchema(NakafaAgentMarkdownSchema),
  Problem: toOpenApiSchema(NakafaProblemDetailsSchema),
  QuranReference: toOpenApiSchema(NakafaAgentQuranReferenceSchema),
  SearchResult: toOpenApiSchema(NakafaAgentSearchResultSchema),
  Taxonomy: toOpenApiSchema(NakafaAgentTaxonomySchema),
};

/** Query parameter schemas retain the runtime decoding constraints. */
export const OPENAPI_PARAMETER_SCHEMAS = {
  contentRef: toOpenApiParameterSchema(NakafaAgentContentRefInputSchema),
  quranFromVerse: toOpenApiParameterSchema(
    NakafaAgentQuranReferenceOptionsSchema.fields.from_verse
  ),
  quranIncludeTafsir: toOpenApiParameterSchema(
    NakafaAgentQuranReferenceOptionsSchema.fields.include_tafsir
  ),
  quranLocale: toOpenApiParameterSchema(
    NakafaAgentQuranReferenceOptionsSchema.fields.locale
  ),
  quranSurah: toOpenApiParameterSchema(
    NakafaAgentQuranReferenceOptionsSchema.fields.surah
  ),
  quranToVerse: toOpenApiParameterSchema(
    NakafaAgentQuranReferenceOptionsSchema.fields.to_verse
  ),
  searchLimit: toOpenApiParameterSchema(
    NakafaAgentSearchOptionsSchema.fields.limit
  ),
  searchLocale: toOpenApiParameterSchema(
    NakafaAgentSearchOptionsSchema.fields.locale
  ),
  searchOffset: toOpenApiParameterSchema(
    NakafaAgentSearchOptionsSchema.fields.offset
  ),
  searchQueries: toOpenApiParameterSchema(
    NakafaAgentSearchOptionsSchema.fields.queries
  ),
  searchSection: toOpenApiParameterSchema(
    NakafaAgentSearchOptionsSchema.fields.section
  ),
  taxonomyLocale: toOpenApiParameterSchema(
    NakafaAgentTaxonomyOptionsSchema.fields.locale
  ),
};

/** Removes transport-inexpressible null alternatives from parameters. */
function toOpenApiParameterSchema(schema: Schema.Constraint) {
  const generated = toOpenApiSchema(schema);
  if (
    !(Predicate.isReadonlyObject(generated) && Array.isArray(generated.anyOf))
  ) {
    return generated;
  }
  const alternatives = generated.anyOf.filter(
    (candidate) =>
      !(Predicate.isReadonlyObject(candidate) && candidate.type === "null")
  );
  if (
    alternatives.length !== 1 ||
    !Predicate.isReadonlyObject(alternatives[0])
  ) {
    return { ...generated, anyOf: alternatives };
  }
  const siblings = Object.fromEntries(
    Object.entries(generated).filter(([key]) => key !== "anyOf")
  );
  return { ...alternatives[0], ...siblings };
}

/** Inlines Effect definitions so component references remain local. */
function inlineDefinitions(
  value: unknown,
  definitions: Readonly<Record<string, unknown>>,
  activeDefinitions: readonly string[]
): unknown {
  if (Array.isArray(value)) {
    return value.map((item) =>
      inlineDefinitions(item, definitions, activeDefinitions)
    );
  }
  if (!Predicate.isReadonlyObject(value)) {
    return value;
  }

  const reference = value.$ref;
  const definitionName =
    typeof reference === "string"
      ? reference.match(LOCAL_DEFINITION_REFERENCE_PATTERN)?.[1]
      : undefined;
  if (definitionName && !activeDefinitions.includes(definitionName)) {
    const definition = definitions[definitionName];
    if (definition !== undefined) {
      const resolved = inlineDefinitions(definition, definitions, [
        ...activeDefinitions,
        definitionName,
      ]);
      const siblings = inlineEntries(value, definitions, activeDefinitions, [
        "$ref",
      ]);
      return Predicate.isReadonlyObject(resolved)
        ? { ...resolved, ...siblings }
        : resolved;
    }
  }
  return inlineEntries(value, definitions, activeDefinitions, []);
}

/** Recursively converts object properties while omitting selected keys. */
function inlineEntries(
  value: Readonly<Record<string, unknown>>,
  definitions: Readonly<Record<string, unknown>>,
  activeDefinitions: readonly string[],
  omittedKeys: readonly string[]
) {
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !omittedKeys.includes(key))
      .map(([key, item]) => [
        key,
        inlineDefinitions(item, definitions, activeDefinitions),
      ])
  );
}
