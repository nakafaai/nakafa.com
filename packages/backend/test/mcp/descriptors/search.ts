export const NAKAFA_SEARCH_CONTENT_TOOL = {
  name: "nakafa_search_content",
  title: "Search Nakafa content",
  description:
    "Search Nakafa's signed public educational content with stable pagination.",
  inputSchema: {
    type: "object",
    $defs: {},
    properties: {
      limit: {
        anyOf: [{ type: "integer", minimum: 1, maximum: 10 }, { type: "null" }],
      },
      locale: {
        anyOf: [{ type: "string", enum: ["en", "id", "de"] }, { type: "null" }],
      },
      offset: {
        anyOf: [{ type: "integer", minimum: 0, maximum: 9 }, { type: "null" }],
      },
      queries: {
        type: "array",
        items: { type: "string" },
        maxItems: 4,
        description:
          "Optional search-engine query strings over synced Nakafa title, route, localized labels, and content text. Use one string for one search, multiple strings for unique alternate phrasings in the same section and locale. Preserve exact identifiers such as names, years, labels, canonical IDs, and URLs. Use limit for requested counts. Use separate parallel search tool calls when section filters differ.",
      },
      section: {
        type: "string",
        enum: ["articles", "material", "tryout", "quran"],
        description:
          'Optional section filter. Use "material" for lessons, practice, school materials, class or grade topics, and study content. Use "articles" only when the user explicitly asks for articles, news, essays, analysis, or editorial content. Use "quran" for surah, ayah, tafsir, or Quran references. Omit this filter for broad topic discovery.',
      },
    },
    additionalProperties: true,
    description: "Nakafa content search options.",
  },
  annotations: {
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
    readOnlyHint: true,
  },
  outputSchema: {
    $defs: {},
    anyOf: [
      {
        type: "object",
        properties: {
          count: {
            type: "integer",
            minimum: 0,
            description: "Number of returned results.",
          },
          has_more: {
            type: "boolean",
            description: "Whether another page is available.",
          },
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                alignmentId: { type: "string" },
                assetId: { type: "string" },
                conceptId: { type: "string" },
                content_id: { type: "string" },
                learningObjectId: { type: "string" },
                lensId: { type: "string" },
                locale: {
                  type: "string",
                  enum: ["en", "id", "de"],
                  description: "Locale of the referenced content.",
                },
                route: { type: "string" },
                section: {
                  type: "string",
                  enum: ["articles", "material", "tryout", "quran"],
                  description: "Top-level Nakafa content section.",
                },
                url: { type: "string" },
                markdown_url: { type: "string" },
                description: {
                  type: "string",
                  description: "Short content description for search results.",
                },
                title: {
                  type: "string",
                  description: "Human-readable content title.",
                },
                excerpt: {
                  type: "string",
                  description:
                    "Plain-text search excerpt with matched context.",
                },
              },
              required: [
                "alignmentId",
                "assetId",
                "conceptId",
                "content_id",
                "learningObjectId",
                "lensId",
                "locale",
                "route",
                "section",
                "url",
                "description",
                "title",
                "excerpt",
              ],
              additionalProperties: true,
              description: "Searchable Nakafa content result item.",
            },
            description: "Bounded search result page.",
          },
          limit: {
            type: "integer",
            exclusiveMinimum: 0,
            description: "Requested page size.",
          },
          next_offset: {
            type: "integer",
            minimum: 0,
            description: "Next page offset when another page is available.",
          },
          offset: {
            type: "integer",
            minimum: 0,
            description: "Current result offset.",
          },
        },
        required: ["count", "has_more", "items", "limit", "offset"],
        additionalProperties: true,
        description: "Paginated Nakafa content search result.",
      },
      {
        type: "object",
        properties: {
          error: {
            type: "object",
            properties: {
              message: { type: "string" },
              suggestions: {
                type: "array",
                items: { type: "string" },
                minItems: 1,
              },
            },
            required: ["message", "suggestions"],
            additionalProperties: true,
          },
        },
        required: ["error"],
        additionalProperties: true,
      },
    ],
    type: "object",
  },
};
