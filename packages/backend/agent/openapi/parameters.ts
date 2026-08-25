import { QURAN_SURAH_COUNT } from "@nakafa/aksara-contracts/quran/spec";
import { OPENAPI_CONTENT_ID_EXAMPLE } from "@repo/backend/agent/openapi/examples";
import { OPENAPI_PARAMETER_SCHEMAS } from "@repo/backend/agent/openapi/schema";
import {
  NAKAFA_AGENT_DEFAULT_LIMIT,
  NAKAFA_AGENT_MAX_LIMIT,
} from "@repo/contents/_types/agent/search";

interface ParameterInput {
  readonly description: string;
  readonly example: boolean | number | string | readonly string[];
  readonly explode?: boolean;
  readonly name: string;
  readonly required?: boolean;
  readonly schema: unknown;
  readonly style?: "form";
}

/** Builds one typed OpenAPI query parameter. */
function queryParameter(input: ParameterInput) {
  return {
    description: input.description,
    example: input.example,
    ...(input.explode === undefined ? {} : { explode: input.explode }),
    in: "query",
    name: input.name,
    required: input.required ?? false,
    schema: input.schema,
    ...(input.style === undefined ? {} : { style: input.style }),
  };
}

export const SEARCH_PARAMETERS = [
  queryParameter({
    description: "One or more alternate search phrases.",
    example: ["linear equations"],
    explode: true,
    name: "query",
    schema: OPENAPI_PARAMETER_SCHEMAS.searchQueries,
    style: "form",
  }),
  queryParameter({
    description: "Optional top-level content section.",
    example: "material",
    name: "section",
    schema: OPENAPI_PARAMETER_SCHEMAS.searchSection,
  }),
  queryParameter({
    description: "Content locale. Defaults to English.",
    example: "en",
    name: "locale",
    schema: OPENAPI_PARAMETER_SCHEMAS.searchLocale,
  }),
  queryParameter({
    description: `Page size. Defaults to ${NAKAFA_AGENT_DEFAULT_LIMIT} and cannot exceed ${NAKAFA_AGENT_MAX_LIMIT}.`,
    example: NAKAFA_AGENT_DEFAULT_LIMIT,
    name: "limit",
    schema: OPENAPI_PARAMETER_SCHEMAS.searchLimit,
  }),
  queryParameter({
    description: "Zero-based pagination offset.",
    example: 0,
    name: "offset",
    schema: OPENAPI_PARAMETER_SCHEMAS.searchOffset,
  }),
];

export const CONTENT_PARAMETERS = [
  queryParameter({
    description:
      "A readable content ID from a search result with markdown_url, resource URI, or canonical readable Nakafa URL.",
    example: OPENAPI_CONTENT_ID_EXAMPLE,
    name: "ref",
    required: true,
    schema: OPENAPI_PARAMETER_SCHEMAS.contentRef,
  }),
];

export const TAXONOMY_PARAMETERS = [
  queryParameter({
    description: "Locale for localized taxonomy values.",
    example: "en",
    name: "locale",
    schema: OPENAPI_PARAMETER_SCHEMAS.taxonomyLocale,
  }),
];

export const QURAN_PARAMETERS = [
  {
    description: `Surah number from 1 through ${QURAN_SURAH_COUNT}.`,
    example: 1,
    in: "path",
    name: "surah",
    required: true,
    schema: OPENAPI_PARAMETER_SCHEMAS.quranSurah,
  },
  queryParameter({
    description: "First verse number. Defaults to 1.",
    example: 1,
    name: "from_verse",
    schema: OPENAPI_PARAMETER_SCHEMAS.quranFromVerse,
  }),
  queryParameter({
    description: "Last verse number. Defaults to from_verse.",
    example: 7,
    name: "to_verse",
    schema: OPENAPI_PARAMETER_SCHEMAS.quranToVerse,
  }),
  queryParameter({
    description: "Translation locale. Defaults to English.",
    example: "en",
    name: "locale",
    schema: OPENAPI_PARAMETER_SCHEMAS.quranLocale,
  }),
  queryParameter({
    description: "Include reviewed tafsir when available.",
    example: false,
    name: "include_tafsir",
    schema: OPENAPI_PARAMETER_SCHEMAS.quranIncludeTafsir,
  }),
];
