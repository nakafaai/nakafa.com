import { quranReferenceOutput } from "@repo/backend/test/mcp/descriptors/quran/output";

export const NAKAFA_GET_QURAN_REFERENCE_TOOL = {
  name: "nakafa_get_quran_reference",
  title: "Read a Quran reference",
  description:
    "Read a bounded Quran verse range with reviewed translation and optional tafsir.",
  inputSchema: {
    type: "object",
    $defs: {},
    properties: {
      from_verse: {
        anyOf: [
          {
            type: "integer",
            exclusiveMinimum: 0,
            maximum: Number.MAX_SAFE_INTEGER,
          },
          { type: "null" },
        ],
      },
      include_tafsir: { anyOf: [{ type: "boolean" }, { type: "null" }] },
      locale: {
        anyOf: [{ type: "string", enum: ["en", "id", "de"] }, { type: "null" }],
      },
      surah: {
        type: "integer",
        minimum: 1,
        maximum: 114,
        description: "Surah number.",
      },
      to_verse: {
        type: "integer",
        exclusiveMinimum: 0,
        description: "Last verse number to include; defaults to from_verse.",
        maximum: Number.MAX_SAFE_INTEGER,
      },
    },
    required: ["surah"],
    additionalProperties: true,
    description: "Nakafa Quran passage options.",
  },
  annotations: {
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
    readOnlyHint: true,
  },
  outputSchema: {
    $defs: {
      QuranText: {
        type: "string",
        pattern: "\\S",
        description: "Source-authenticated transliterated surah name.",
      },
      QuranText_1: {
        type: "string",
        pattern: "\\S",
        description:
          "Authored Quran text containing at least one visible character.",
      },
    },
    anyOf: [
      {
        anyOf: [
          quranReferenceOutput("en"),
          quranReferenceOutput("id"),
          quranReferenceOutput("de"),
        ],
        description:
          "Nakafa Quran reference with semantic notes and signed source attribution.",
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
