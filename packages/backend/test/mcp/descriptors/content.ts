export const NAKAFA_GET_CONTENT_TOOL = {
  name: "nakafa_get_content",
  title: "Read Nakafa content",
  description:
    "Read full agent-ready Markdown for a readable Nakafa content ID or canonical URL. Search results without markdown_url are citation-only catalog entries.",
  inputSchema: {
    type: "object",
    $defs: {},
    properties: { content_ref: { type: "string", minLength: 1 } },
    required: ["content_ref"],
    additionalProperties: true,
    description: "Nakafa content read options.",
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
            description:
              "Short content description when signed metadata provides one.",
          },
          text: {
            type: "string",
            description: "Full agent-readable markdown text.",
          },
          title: {
            type: "string",
            description: "Human-readable content title.",
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
          "markdown_url",
          "text",
          "title",
        ],
        additionalProperties: true,
        description: "Full Nakafa content markdown payload.",
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
