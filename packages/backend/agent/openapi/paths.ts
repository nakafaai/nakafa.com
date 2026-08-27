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
  "503": problemResponse("The signed content service is unavailable."),
};

const RATE_LIMIT_RESPONSE = {
  ...problemResponse(
    "The client exceeded the bounded application quota. Honor Retry-After and retry with backoff."
  ),
  headers: {
    "Retry-After": {
      description: "Required retry delay in seconds.",
      schema: { type: "string" },
    },
  },
};

const METERED_RESPONSES = { ...COMMON_ERRORS, "429": RATE_LIMIT_RESPONSE };

/** Adds the contract shared by read-only API operations. */
function readOperation(input: {
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
    responses: input.responses,
    summary: input.summary,
    tags: ["Public read API"],
    "x-nakafa-read-only": true,
  };
}

export const OPENAPI_PATHS = {
  "/openapi.json": {
    get: readOperation({
      description:
        "Returns the OpenAPI 3.1 contract with one-hour cache revalidation.",
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
        "304": {
          description: "The cached contract is current.",
          headers: {
            ETag: {
              description: "Validator for the exact serialized contract.",
              schema: { type: "string" },
            },
          },
        },
        ...COMMON_ERRORS,
      },
      summary: "Read the OpenAPI contract",
    }),
  },
  "/v1/quran/{surah}": {
    get: readOperation({
      description:
        "Returns a bounded Quran verse range with semantic translation notes, signed Arabic and translation sources, and explicit locale-specific tafsir access.",
      operationId: "getNakafaQuranReference",
      parameters: QURAN_PARAMETERS,
      responses: {
        "200": successResponse(
          "A source-grounded Quran reference.",
          "QuranReference"
        ),
        "404": problemResponse("The requested surah was not found."),
        ...METERED_RESPONSES,
      },
      summary: "Read a source-grounded Quran reference",
    }),
  },
  "/v1": {
    get: readOperation({
      description:
        "Returns stable service identity and links for developers and agents.",
      operationId: "getNakafaApiIndex",
      responses: {
        "200": successResponse("API service index.", "ApiIndex"),
        ...COMMON_ERRORS,
      },
      summary: "Read the API index",
    }),
  },
  "/v1/content": {
    get: readOperation({
      description:
        "Resolves a readable content ID, resource URI, or canonical URL to agent-readable Markdown.",
      operationId: "getNakafaContent",
      parameters: CONTENT_PARAMETERS,
      responses: {
        "200": successResponse("Resolved public content.", "Content"),
        "404": problemResponse("The content reference was not found."),
        ...METERED_RESPONSES,
      },
      summary: "Read public content",
    }),
  },
  "/v1/health": {
    get: readOperation({
      description:
        "Returns process health and an observation timestamp without reading content data.",
      operationId: "getNakafaApiHealth",
      responses: {
        "200": successResponse("The service is available.", "ApiHealth"),
        ...COMMON_ERRORS,
      },
      summary: "Check API health",
    }),
  },
  "/v1/search": {
    get: readOperation({
      description:
        "Searches the current signed Nakafa publication with stable pagination.",
      operationId: "searchNakafaContent",
      parameters: SEARCH_PARAMETERS,
      responses: {
        "200": successResponse("A paginated search result.", "SearchResult"),
        ...METERED_RESPONSES,
      },
      summary: "Search public content",
    }),
  },
  "/v1/taxonomy": {
    get: readOperation({
      description:
        "Returns current public sections, locales, categories, counts, and agent tools.",
      operationId: "getNakafaTaxonomy",
      parameters: TAXONOMY_PARAMETERS,
      responses: {
        "200": successResponse("Current public taxonomy.", "Taxonomy"),
        ...METERED_RESPONSES,
      },
      summary: "Read public taxonomy",
    }),
  },
};
