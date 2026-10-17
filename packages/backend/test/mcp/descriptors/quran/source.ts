import {
  POSITIVE_INTEGER,
  RETRIEVED_AT,
  SIGNED_TEXT,
} from "@repo/backend/test/mcp/descriptors/quran/field";
import { Array as Arr, Order, Record } from "effect";

/**
 * An object schema that requires every one of its fields. The required list is
 * sorted alphabetically, the order that the pinned answers use.
 */
function requiredObject(properties: Readonly<Record<string, object>>) {
  return {
    type: "object",
    properties,
    required: Arr.sort(Record.keys(properties), Order.String),
    additionalProperties: true,
  };
}

/** One stored artifact: its byte count, file count, and digest. */
const ARTIFACT = requiredObject({
  byte_count: POSITIVE_INTEGER,
  digest: { type: "string" },
  file_count: POSITIVE_INTEGER,
});

/**
 * The fields that every signed source carries, whether Nakafa stores its text or
 * links to it. The caller gives the kind and the id of the source.
 */
function signedFields(kind: string, id: string) {
  return {
    id: { type: "string", enum: [id] },
    kind: { type: "string", enum: [kind] },
    label: SIGNED_TEXT,
    notice: SIGNED_TEXT,
    publisher: SIGNED_TEXT,
    retrieved_at: RETRIEVED_AT,
    source_url: { type: "string" },
    update_url: { type: "string" },
    version: SIGNED_TEXT,
  };
}

/** The terms of a signed source: the fields its kind names, and the URL of its terms. */
function signedTerms(fields: Readonly<Record<string, object>>) {
  return requiredObject({ ...fields, url: { type: "string" } });
}

/**
 * A signed source whose text Nakafa stores as an embedded artifact. The Arabic
 * text, the embedded tafsir, and every translation use this shape.
 */
export function embeddedSource(id: string) {
  return requiredObject({
    artifact: ARTIFACT,
    ...signedFields("embedded", id),
    terms: signedTerms({ artifact: ARTIFACT }),
  });
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
  return requiredObject({
    ...signedFields("external", id),
    terms: signedTerms({ access: { type: "string", enum: ["link-only"] } }),
  });
}
