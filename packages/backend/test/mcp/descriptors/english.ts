export const QURAN_REFERENCE_ENGLISH_OUTPUT = {
  type: "object",
  properties: {
    alignmentId: { type: "string" },
    assetId: { type: "string" },
    conceptId: { type: "string" },
    content_id: { type: "string" },
    learningObjectId: { type: "string" },
    lensId: { type: "string" },
    locale: { type: "string", enum: ["en"] },
    route: { type: "string" },
    section: {
      type: "string",
      enum: ["articles", "material", "tryout", "quran"],
      description: "Top-level Nakafa content section.",
    },
    url: { type: "string" },
    markdown_url: { type: "string" },
    name: { $ref: "#/$defs/QuranText" },
    pre_bismillah: {
      anyOf: [
        {
          type: "object",
          properties: {
            arabic: {
              type: "string",
              description: "Exact signed Arabic Bismillah text.",
            },
            translation: {
              type: "object",
              properties: {
                notes: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      number: { type: "integer", exclusiveMinimum: 0 },
                      referenceOffset: { type: "integer", minimum: 0 },
                      text: { type: "string" },
                    },
                    required: ["number", "referenceOffset", "text"],
                    additionalProperties: true,
                  },
                },
                segments: {
                  type: "array",
                  items: {
                    anyOf: [
                      {
                        type: "object",
                        properties: {
                          kind: { type: "string", enum: ["text"] },
                          offset: { type: "integer", minimum: 0 },
                          value: { type: "string" },
                        },
                        required: ["kind", "offset", "value"],
                        additionalProperties: true,
                      },
                      {
                        type: "object",
                        properties: {
                          kind: { type: "string", enum: ["note"] },
                          number: { type: "integer", exclusiveMinimum: 0 },
                          offset: { type: "integer", minimum: 0 },
                        },
                        required: ["kind", "number", "offset"],
                        additionalProperties: true,
                      },
                    ],
                  },
                },
              },
              required: ["notes", "segments"],
              additionalProperties: true,
              description:
                "Reviewed locale translation of the Bismillah with exact source notes.",
            },
          },
          required: ["arabic", "translation"],
          additionalProperties: true,
        },
        { type: "null" },
      ],
      description:
        "Dedicated Bismillah before the selected numbered verses when present.",
    },
    revelation: {
      type: "string",
      enum: ["Meccan", "Medinan"],
      description: "Source-authenticated revelation place.",
    },
    verses: {
      type: "array",
      items: {
        type: "object",
        properties: {
          arabic: { type: "string", description: "Arabic Quran verse text." },
          number: {
            type: "integer",
            exclusiveMinimum: 0,
            description: "Verse number inside the surah.",
          },
          tafsir: {
            anyOf: [
              {
                type: "string",
                description:
                  "Reviewed tafsir text when the locale has an embedded edition and it was requested.",
              },
              { type: "null" },
            ],
          },
          translation: {
            type: "object",
            properties: {
              notes: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    number: { type: "integer", exclusiveMinimum: 0 },
                    referenceOffset: { type: "integer", minimum: 0 },
                    text: { type: "string" },
                  },
                  required: ["number", "referenceOffset", "text"],
                  additionalProperties: true,
                },
              },
              segments: {
                type: "array",
                items: {
                  anyOf: [
                    {
                      type: "object",
                      properties: {
                        kind: { type: "string", enum: ["text"] },
                        offset: { type: "integer", minimum: 0 },
                        value: { type: "string" },
                      },
                      required: ["kind", "offset", "value"],
                      additionalProperties: true,
                    },
                    {
                      type: "object",
                      properties: {
                        kind: { type: "string", enum: ["note"] },
                        number: { type: "integer", exclusiveMinimum: 0 },
                        offset: { type: "integer", minimum: 0 },
                      },
                      required: ["kind", "number", "offset"],
                      additionalProperties: true,
                    },
                  ],
                },
              },
            },
            required: ["notes", "segments"],
            additionalProperties: true,
            description:
              "Translation represented as text and note-reference segments plus exact source notes.",
          },
        },
        required: ["arabic", "number", "translation"],
        additionalProperties: true,
        description: "Nakafa Quran verse reference.",
      },
      minItems: 1,
      description: "Bounded Quran verses.",
    },
    meaning: {
      type: "object",
      properties: {
        locale: { type: "string", enum: ["en"] },
        text: { $ref: "#/$defs/QuranText_1" },
      },
      required: ["locale", "text"],
      additionalProperties: true,
    },
    sources: {
      type: "object",
      properties: {
        arabic: {
          type: "object",
          properties: {
            artifact: {
              type: "object",
              properties: {
                byte_count: { type: "integer", exclusiveMinimum: 0 },
                digest: { type: "string" },
                file_count: { type: "integer", exclusiveMinimum: 0 },
              },
              required: ["byte_count", "digest", "file_count"],
              additionalProperties: true,
            },
            id: { type: "string", enum: ["tanzil-text"] },
            kind: { type: "string", enum: ["embedded"] },
            label: {
              type: "string",
              pattern: "^\\S[\\s\\S]*\\S$|^\\S$|^$",
              minLength: 1,
            },
            notice: {
              type: "string",
              pattern: "^\\S[\\s\\S]*\\S$|^\\S$|^$",
              minLength: 1,
            },
            publisher: {
              type: "string",
              pattern: "^\\S[\\s\\S]*\\S$|^\\S$|^$",
              minLength: 1,
            },
            retrieved_at: {
              type: "string",
              pattern: "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}Z$",
            },
            source_url: { type: "string" },
            terms: {
              type: "object",
              properties: {
                artifact: {
                  type: "object",
                  properties: {
                    byte_count: { type: "integer", exclusiveMinimum: 0 },
                    digest: { type: "string" },
                    file_count: { type: "integer", exclusiveMinimum: 0 },
                  },
                  required: ["byte_count", "digest", "file_count"],
                  additionalProperties: true,
                },
                url: { type: "string" },
              },
              required: ["artifact", "url"],
              additionalProperties: true,
            },
            update_url: { type: "string" },
            version: {
              type: "string",
              pattern: "^\\S[\\s\\S]*\\S$|^\\S$|^$",
              minLength: 1,
            },
          },
          required: [
            "artifact",
            "id",
            "kind",
            "label",
            "notice",
            "publisher",
            "retrieved_at",
            "source_url",
            "terms",
            "update_url",
            "version",
          ],
          additionalProperties: true,
        },
        translation: {
          type: "object",
          properties: {
            artifact: {
              type: "object",
              properties: {
                byte_count: { type: "integer", exclusiveMinimum: 0 },
                digest: { type: "string" },
                file_count: { type: "integer", exclusiveMinimum: 0 },
              },
              required: ["byte_count", "digest", "file_count"],
              additionalProperties: true,
            },
            id: { type: "string", enum: ["quranenc-english"] },
            kind: { type: "string", enum: ["embedded"] },
            label: {
              type: "string",
              pattern: "^\\S[\\s\\S]*\\S$|^\\S$|^$",
              minLength: 1,
            },
            notice: {
              type: "string",
              pattern: "^\\S[\\s\\S]*\\S$|^\\S$|^$",
              minLength: 1,
            },
            publisher: {
              type: "string",
              pattern: "^\\S[\\s\\S]*\\S$|^\\S$|^$",
              minLength: 1,
            },
            retrieved_at: {
              type: "string",
              pattern: "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}Z$",
            },
            source_url: { type: "string" },
            terms: {
              type: "object",
              properties: {
                artifact: {
                  type: "object",
                  properties: {
                    byte_count: { type: "integer", exclusiveMinimum: 0 },
                    digest: { type: "string" },
                    file_count: { type: "integer", exclusiveMinimum: 0 },
                  },
                  required: ["byte_count", "digest", "file_count"],
                  additionalProperties: true,
                },
                url: { type: "string" },
              },
              required: ["artifact", "url"],
              additionalProperties: true,
            },
            update_url: { type: "string" },
            version: {
              type: "string",
              pattern: "^\\S[\\s\\S]*\\S$|^\\S$|^$",
              minLength: 1,
            },
            locale: { type: "string", enum: ["en"] },
          },
          required: [
            "artifact",
            "id",
            "kind",
            "label",
            "notice",
            "publisher",
            "retrieved_at",
            "source_url",
            "terms",
            "update_url",
            "version",
            "locale",
          ],
          additionalProperties: true,
        },
      },
      required: ["arabic", "translation"],
      additionalProperties: true,
    },
    tafsir_access: {
      type: "object",
      properties: {
        kind: { type: "string", enum: ["external"] },
        locale: { type: "string", enum: ["en"] },
        notice: {
          type: "string",
          pattern: "^\\S[\\s\\S]*\\S$|^\\S$|^$",
          minLength: 1,
        },
        source: {
          type: "object",
          properties: {
            id: { type: "string", enum: ["mokhtasar-english"] },
            kind: { type: "string", enum: ["external"] },
            label: {
              type: "string",
              pattern: "^\\S[\\s\\S]*\\S$|^\\S$|^$",
              minLength: 1,
            },
            notice: {
              type: "string",
              pattern: "^\\S[\\s\\S]*\\S$|^\\S$|^$",
              minLength: 1,
            },
            publisher: {
              type: "string",
              pattern: "^\\S[\\s\\S]*\\S$|^\\S$|^$",
              minLength: 1,
            },
            retrieved_at: {
              type: "string",
              pattern: "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}Z$",
            },
            source_url: { type: "string" },
            terms: {
              type: "object",
              properties: {
                access: { type: "string", enum: ["link-only"] },
                url: { type: "string" },
              },
              required: ["access", "url"],
              additionalProperties: true,
            },
            update_url: { type: "string" },
            version: {
              type: "string",
              pattern: "^\\S[\\s\\S]*\\S$|^\\S$|^$",
              minLength: 1,
            },
          },
          required: [
            "id",
            "kind",
            "label",
            "notice",
            "publisher",
            "retrieved_at",
            "source_url",
            "terms",
            "update_url",
            "version",
          ],
          additionalProperties: true,
        },
      },
      required: ["kind", "locale", "notice", "source"],
      additionalProperties: true,
      description: "Signed link-only English Tafsir access.",
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
    "name",
    "pre_bismillah",
    "revelation",
    "verses",
    "meaning",
    "sources",
    "tafsir_access",
  ],
  additionalProperties: true,
};
