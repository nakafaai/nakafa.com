export const NAKAFA_GET_TAXONOMY_TOOL = {
  name: "nakafa_get_taxonomy",
  title: "Read Nakafa taxonomy",
  description:
    "List supported Nakafa sections, locales, categories, counts, and tools.",
  inputSchema: {
    type: "object",
    $defs: {},
    properties: {
      locale: {
        anyOf: [{ type: "string", enum: ["en", "id", "de"] }, { type: "null" }],
      },
    },
    additionalProperties: true,
    description: "Nakafa taxonomy options.",
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
          articles: {
            type: "object",
            properties: {
              categories: {
                type: "array",
                items: { type: "string" },
                description: "Supported article categories.",
              },
            },
            required: ["categories"],
            additionalProperties: true,
            description: "Article taxonomy.",
          },
          content_counts: {
            type: "array",
            items: {
              type: "object",
              properties: {
                count: {
                  type: "integer",
                  minimum: 0,
                  description: "Indexed content count.",
                },
                locale: {
                  type: "string",
                  enum: ["en", "id", "de"],
                  description: "Locale for this count.",
                },
              },
              required: ["count", "locale"],
              additionalProperties: true,
            },
            description: "Indexed content counts by locale.",
          },
          default_locale: {
            type: "string",
            enum: ["en", "id", "de"],
            description: "Default Nakafa locale.",
          },
          endpoints: {
            type: "object",
            properties: {
              direct: { type: "string" },
              recommended: { type: "string" },
              root_note: {
                type: "string",
                description: "Root URL connection guidance.",
              },
            },
            required: ["direct", "recommended", "root_note"],
            additionalProperties: true,
            description: "MCP endpoint guidance.",
          },
          tryout: {
            type: "object",
            properties: {
              countries: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: {
                      type: "string",
                      description: "Canonical route/schema identifier.",
                    },
                    label: {
                      type: "string",
                      description: "Localized display label.",
                    },
                  },
                  required: ["id", "label"],
                  additionalProperties: true,
                  description:
                    "Supported taxonomy value with a localized label.",
                },
                description: "Supported try-out countries.",
              },
              exams: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: {
                      type: "string",
                      description: "Canonical route/schema identifier.",
                    },
                    label: {
                      type: "string",
                      description: "Localized display label.",
                    },
                  },
                  required: ["id", "label"],
                  additionalProperties: true,
                  description:
                    "Supported taxonomy value with a localized label.",
                },
                description: "Supported try-out exams.",
              },
            },
            required: ["countries", "exams"],
            additionalProperties: true,
            description: "Try-out taxonomy.",
          },
          locale: {
            type: "string",
            enum: ["en", "id", "de"],
            description: "Locale used for this taxonomy response.",
          },
          locales: {
            type: "array",
            items: { type: "string", enum: ["en", "id", "de"] },
            description: "Supported content locales.",
          },
          quran: {
            type: "object",
            properties: {
              surah_count: {
                type: "integer",
                exclusiveMinimum: 0,
                description: "Indexed Quran surah count.",
              },
            },
            required: ["surah_count"],
            additionalProperties: true,
            description: "Quran taxonomy.",
          },
          sections: {
            type: "array",
            items: {
              type: "string",
              enum: ["articles", "material", "tryout", "quran"],
              description:
                'Public Nakafa content section: "material" lessons, "tryout" exam simulations, "articles" editorial/news content, or "quran" Quran references.',
            },
            description: "Supported top-level content sections.",
          },
          tools: {
            type: "array",
            items: { type: "string" },
            description: "Public MCP tools exposed by Nakafa.",
          },
        },
        required: [
          "articles",
          "content_counts",
          "default_locale",
          "endpoints",
          "tryout",
          "locale",
          "locales",
          "quran",
          "sections",
          "tools",
        ],
        additionalProperties: true,
        description: "Nakafa public content taxonomy.",
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
