import {
  NakafaApiHealthSchema,
  NakafaApiIndexSchema,
  NakafaProblemDetailsSchema,
} from "@repo/contents/agent/schema/api";
import { NakafaAgentQuranReferenceOptionsSchema } from "@repo/contents/agent/schema/quran/input";
import { NakafaAgentQuranReferenceSchema } from "@repo/contents/agent/schema/quran/reference";
import {
  NakafaAgentContentRefInputSchema,
  NakafaAgentMarkdownSchema,
} from "@repo/contents/agent/schema/read";
import {
  NakafaAgentSearchOptionsSchema,
  NakafaAgentSearchResultSchema,
} from "@repo/contents/agent/schema/search";
import {
  NakafaAgentTaxonomyOptionsSchema,
  NakafaAgentTaxonomySchema,
} from "@repo/contents/agent/schema/taxonomy";
import { Schema } from "effect";

/** Keeps these non-recursive public contracts inline using Effect's reference policy. */
function toOpenApiSchema(schema: Schema.Constraint) {
  return Schema.toJsonSchemaDocument(schema, {
    referencePolicy: () => undefined,
  }).schema;
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

/** HTTP defaults use the decoded scalar schema because URL parameters cannot carry null. */
export const OPENAPI_PARAMETER_SCHEMAS = {
  contentRef: toOpenApiSchema(NakafaAgentContentRefInputSchema),
  quranFromVerse: toOpenApiSchema(
    Schema.toType(NakafaAgentQuranReferenceOptionsSchema.fields.from_verse)
  ),
  quranIncludeTafsir: toOpenApiSchema(
    Schema.toType(NakafaAgentQuranReferenceOptionsSchema.fields.include_tafsir)
  ),
  quranLocale: toOpenApiSchema(
    Schema.toType(NakafaAgentQuranReferenceOptionsSchema.fields.locale)
  ),
  quranSurah: toOpenApiSchema(
    NakafaAgentQuranReferenceOptionsSchema.fields.surah
  ),
  quranToVerse: toOpenApiSchema(
    NakafaAgentQuranReferenceOptionsSchema.fields.to_verse
  ),
  searchLimit: toOpenApiSchema(
    Schema.toType(NakafaAgentSearchOptionsSchema.fields.limit)
  ),
  searchLocale: toOpenApiSchema(
    Schema.toType(NakafaAgentSearchOptionsSchema.fields.locale)
  ),
  searchOffset: toOpenApiSchema(
    Schema.toType(NakafaAgentSearchOptionsSchema.fields.offset)
  ),
  searchQueries: toOpenApiSchema(NakafaAgentSearchOptionsSchema.fields.queries),
  searchSection: toOpenApiSchema(NakafaAgentSearchOptionsSchema.fields.section),
  taxonomyLocale: toOpenApiSchema(
    Schema.toType(NakafaAgentTaxonomyOptionsSchema.fields.locale)
  ),
};
