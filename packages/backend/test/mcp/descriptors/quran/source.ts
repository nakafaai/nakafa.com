import {
  POSITIVE_INTEGER,
  RETRIEVED_AT,
  SIGNED_TEXT,
} from "@repo/backend/test/mcp/descriptors/quran/field";

/** One stored artifact: its byte count, file count, and digest. */
const ARTIFACT = {
  type: "object",
  properties: {
    byte_count: POSITIVE_INTEGER,
    digest: { type: "string" },
    file_count: POSITIVE_INTEGER,
  },
  required: ["byte_count", "digest", "file_count"],
  additionalProperties: true,
};

/**
 * A signed source whose text Nakafa stores as an embedded artifact. The Arabic
 * text, the embedded tafsir, and every translation use this shape.
 */
export function embeddedSource(id: string) {
  return {
    type: "object",
    properties: {
      artifact: ARTIFACT,
      id: { type: "string", enum: [id] },
      kind: { type: "string", enum: ["embedded"] },
      label: SIGNED_TEXT,
      notice: SIGNED_TEXT,
      publisher: SIGNED_TEXT,
      retrieved_at: RETRIEVED_AT,
      source_url: { type: "string" },
      terms: {
        type: "object",
        properties: {
          artifact: ARTIFACT,
          url: { type: "string" },
        },
        required: ["artifact", "url"],
        additionalProperties: true,
      },
      update_url: { type: "string" },
      version: SIGNED_TEXT,
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
  };
}

/** A translation source: the embedded shape, plus the locale it translates into. */
export function translationSource(id: string, locale: string) {
  const source = embeddedSource(id);
  return {
    ...source,
    properties: {
      ...source.properties,
      locale: { type: "string", enum: [locale] },
    },
    required: [...source.required, "locale"],
  };
}

/**
 * A signed source that Nakafa links to instead of storing. Its terms grant
 * link-only access.
 */
export function externalSource(id: string) {
  return {
    type: "object",
    properties: {
      id: { type: "string", enum: [id] },
      kind: { type: "string", enum: ["external"] },
      label: SIGNED_TEXT,
      notice: SIGNED_TEXT,
      publisher: SIGNED_TEXT,
      retrieved_at: RETRIEVED_AT,
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
      version: SIGNED_TEXT,
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
  };
}
