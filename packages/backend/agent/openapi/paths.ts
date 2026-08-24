import { OPENAPI_RESPONSE_EXAMPLES } from "@repo/backend/agent/openapi/examples";
import {
  CONTENT_PARAMETERS,
  QURAN_PARAMETERS,
  SEARCH_PARAMETERS,
  TAXONOMY_PARAMETERS,
} from "@repo/backend/agent/openapi/parameters";

const JSON_CONTENT = "application/json";
const PROBLEM_CONTENT = "application/problem+json";

/** References one generated success schema. */
function successResponse(
  description: string,
  schemaName: keyof typeof OPENAPI_RESPONSE_EXAMPLES
) {
  return {
    content: {
      [JSON_CONTENT]: {
        example: OPENAPI_RESPONSE_EXAMPLES[schemaName],
        schema: { $ref: `#/components/schemas/${schemaName}` },
      },
    },
    description,
  };
}

/** References the shared RFC 9457 error schema. */
function problemResponse(description: string) {
  return {
    content: {
      [PROBLEM_CONTENT]: {
        schema: { $ref: "#/components/schemas/Problem" },
      },
    },
    description,
  };
}

const COMMON_ERRORS = {
  "400": problemResponse("Malformed request parameters."),
  "403": problemResponse("The request did not pass the public edge guard."),
  "405": problemResponse("The HTTP method is not supported."),
  "406": problemResponse("No acceptable response representation is available."),
  "415": problemResponse("The declared request media type is not supported."),
  "422": problemResponse("The typed request could not be processed."),
  "500": problemResponse("An unexpected server failure occurred."),
  "503": problemResponse(
    "The signed content service is temporarily unavailable."
  ),
};

const PLATFORM_RATE_LIMIT_RESPONSE = {
  description:
    "Vercel Firewall rejected the request at the edge. The platform-owned body is not guaranteed to use Nakafa Problem Details. Honor Retry-After when present and retry with backoff.",
  headers: {
    "Retry-After": {
      description: "Optional platform retry delay in seconds.",
      schema: { type: "string" },
    },
  },
};

const PROTECTED_READ_RESPONSES = {
  ...COMMON_ERRORS,
  "429": PLATFORM_RATE_LIMIT_RESPONSE,
};

const OPENAPI_CONTRACT_RESPONSES = {
  "304": {
    description: "The cached OpenAPI document is still current.",
    headers: {
      ETag: {
        description: "Weak validator for the current contract version.",
        schema: { type: "string" },
      },
    },
  },
};

/** Adds the method and recovery contract shared by read-only API operations. */
function readOperation(input: {
  readonly additionalResponses: Readonly<Record<string, unknown>>;
  readonly description: string;
  readonly operationId: string;
  readonly parameters?: readonly unknown[];
  readonly responses: Readonly<Record<string, unknown>>;
  readonly summary: string;
}) {
  return {
    description: input.description,
    operationId: input.operationId,
    parameters: input.parameters ?? [],
    responses: {
      ...input.responses,
      ...input.additionalResponses,
    },
    summary: input.summary,
    tags: ["Public read API"],
    "x-nakafa-read-only": true,
  };
}

export const OPENAPI_PATHS = {
  "/openapi.json": {
    get: readOperation({
      additionalResponses: OPENAPI_CONTRACT_RESPONSES,
      description:
        "Returns this OpenAPI 3.1 contract. The document may be cached for one hour and supports ETag revalidation.",
      operationId: "getNakafaOpenApi",
      responses: {
        "200": {
          content: {
            [JSON_CONTENT]: {
              example: OPENAPI_RESPONSE_EXAMPLES.OpenApi,
              schema: {
                additionalProperties: true,
                properties: {
                  info: { type: "object" },
                  openapi: { type: "string" },
                  paths: { type: "object" },
                },
                required: ["openapi", "info", "paths"],
                type: "object",
              },
            },
          },
          description: "The canonical Nakafa OpenAPI document.",
        },
      },
      summary: "Read the OpenAPI contract",
    }),
  },
  "/v1": {
    get: readOperation({
      additionalResponses: PROTECTED_READ_RESPONSES,
      description:
        "Returns stable service identity and links for developers and agents.",
      operationId: "getNakafaApiIndex",
      responses: { "200": successResponse("API service index.", "ApiIndex") },
      summary: "Read the API index",
    }),
  },
  "/v1/content": {
    get: readOperation({
      additionalResponses: PROTECTED_READ_RESPONSES,
      description:
        "Resolves a readable search content ID, Nakafa resource URI, or canonical URL to full agent-readable Markdown. Search results without markdown_url are citation-only catalog entries.",
      operationId: "getNakafaContent",
      parameters: CONTENT_PARAMETERS,
      responses: {
        "200": successResponse("Resolved public content.", "Content"),
        "404": problemResponse("The content reference was not found."),
      },
      summary: "Read public content",
    }),
  },
  "/v1/health": {
    get: readOperation({
      additionalResponses: PROTECTED_READ_RESPONSES,
      description:
        "Returns process health and an observation timestamp without reading content data.",
      operationId: "getNakafaApiHealth",
      responses: {
        "200": successResponse("The service is available.", "ApiHealth"),
      },
      summary: "Check API health",
    }),
  },
  "/v1/quran/{surah}": {
    get: readOperation({
      additionalResponses: PROTECTED_READ_RESPONSES,
      description:
        "Returns a bounded reviewed Quran verse range with translation and optional tafsir.",
      operationId: "getNakafaQuranReference",
      parameters: QURAN_PARAMETERS,
      responses: {
        "200": successResponse("A typed Quran reference.", "QuranReference"),
        "404": problemResponse("The requested surah was not found."),
      },
      summary: "Read a Quran reference",
    }),
  },
  "/v1/search": {
    get: readOperation({
      additionalResponses: PROTECTED_READ_RESPONSES,
      description:
        "Searches the current signed Nakafa publication with stable pagination. Repeat query for alternate phrases.",
      operationId: "searchNakafaContent",
      parameters: SEARCH_PARAMETERS,
      responses: {
        "200": successResponse("A paginated search result.", "SearchResult"),
      },
      summary: "Search public content",
    }),
  },
  "/v1/taxonomy": {
    get: readOperation({
      additionalResponses: PROTECTED_READ_RESPONSES,
      description:
        "Returns current public sections, locales, categories, counts, and supported agent tools.",
      operationId: "getNakafaTaxonomy",
      parameters: TAXONOMY_PARAMETERS,
      responses: {
        "200": successResponse("Current public taxonomy.", "Taxonomy"),
      },
      summary: "Read public taxonomy",
    }),
  },
};
