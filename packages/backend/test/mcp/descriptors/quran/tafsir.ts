import { SIGNED_TEXT } from "@repo/backend/test/mcp/descriptors/quran/field";
import {
  embeddedSource,
  externalSource,
} from "@repo/backend/test/mcp/descriptors/quran/source";

/**
 * The tafsir access of a locale whose tafsir is a link to an external edition.
 * The description is the signed sentence that the answer carries.
 */
export function externalTafsirAccess(
  locale: string,
  sourceId: string,
  description: string
) {
  return {
    type: "object",
    properties: {
      kind: { type: "string", enum: ["external"] },
      locale: { type: "string", enum: [locale] },
      notice: SIGNED_TEXT,
      source: externalSource(sourceId),
    },
    required: ["kind", "locale", "notice", "source"],
    additionalProperties: true,
    description,
  };
}

/** The tafsir access of a locale whose tafsir Nakafa embeds as an artifact. */
export function embeddedTafsirAccess(locale: string, sourceId: string) {
  return {
    type: "object",
    properties: {
      kind: { type: "string", enum: ["embedded"] },
      locale: { type: "string", enum: [locale] },
      notice: SIGNED_TEXT,
      source: embeddedSource(sourceId),
    },
    required: ["kind", "locale", "notice", "source"],
    additionalProperties: true,
  };
}
