import {
  embeddedSource,
  translationSource,
} from "@repo/backend/test/mcp/descriptors/quran/source";
import {
  embeddedTafsirAccess,
  externalTafsirAccess,
} from "@repo/backend/test/mcp/descriptors/quran/tafsir";
import { translation } from "@repo/backend/test/mcp/descriptors/quran/translation";

/** The meaning of a verse in one locale. */
function meaningIn(locale: string) {
  return {
    type: "object",
    properties: {
      locale: { type: "string", enum: [locale] },
      text: { $ref: "#/$defs/QuranText_1" },
    },
    required: ["locale", "text"],
    additionalProperties: true,
  };
}

/**
 * The facts that differ between the locales, each a literal of the signed
 * content. The golden pins them so that a change in what the server sends
 * fails. An English answer carries English meaning only. A German or Indonesian
 * answer carries its own meaning or the English meaning.
 */
const LOCALE_FACTS = {
  en: {
    meaning: meaningIn("en"),
    translationId: "quranenc-english",
    tafsir: externalTafsirAccess(
      "en",
      "mokhtasar-english",
      "Signed link-only English Tafsir access."
    ),
  },
  de: {
    meaning: { anyOf: [meaningIn("de"), meaningIn("en")] },
    translationId: "quranenc-german",
    tafsir: externalTafsirAccess(
      "de",
      "mokhtasar-german",
      "Signed link-only German Tafsir access."
    ),
  },
  id: {
    meaning: { anyOf: [meaningIn("id"), meaningIn("en")] },
    translationId: "quranenc-indonesian",
    tafsir: embeddedTafsirAccess("id", "quranenc-tafsir"),
  },
};

/** A locale that the Quran reference answer pins. */
type QuranLocale = keyof typeof LOCALE_FACTS;

/** The Bismillah before the numbered verses, when the passage has one. */
const PRE_BISMILLAH = {
  anyOf: [
    {
      type: "object",
      properties: {
        arabic: {
          type: "string",
          description: "Exact signed Arabic Bismillah text.",
        },
        translation: translation(
          "Reviewed locale translation of the Bismillah with exact source notes."
        ),
      },
      required: ["arabic", "translation"],
      additionalProperties: true,
    },
    { type: "null" },
  ],
  description:
    "Dedicated Bismillah before the selected numbered verses when present.",
};

/** One numbered verse with its Arabic text, its optional tafsir, and its translation. */
const VERSE = {
  type: "object",
  properties: {
    arabic: { type: "string", description: "Arabic Quran verse text." },
    number: {
      type: "integer",
      exclusiveMinimum: 0,
      description: "Verse number inside the surah.",
      maximum: Number.MAX_SAFE_INTEGER,
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
    translation: translation(
      "Translation represented as text and note-reference segments plus exact source notes."
    ),
  },
  required: ["arabic", "number", "translation"],
  additionalProperties: true,
  description: "Nakafa Quran verse reference.",
};

/**
 * The Quran reference answer of one locale. Every part the locales share is
 * written once here, and the locale facts supply the rest.
 */
export function quranReferenceOutput(locale: QuranLocale) {
  const facts = LOCALE_FACTS[locale];
  return {
    type: "object",
    properties: {
      alignmentId: { type: "string" },
      assetId: { type: "string" },
      conceptId: { type: "string" },
      content_id: { type: "string" },
      learningObjectId: { type: "string" },
      lensId: { type: "string" },
      locale: { type: "string", enum: [locale] },
      route: { type: "string" },
      section: {
        type: "string",
        enum: ["articles", "material", "tryout", "quran"],
        description: "Top-level Nakafa content section.",
      },
      url: { type: "string" },
      markdown_url: { type: "string" },
      name: { $ref: "#/$defs/QuranText" },
      pre_bismillah: PRE_BISMILLAH,
      revelation: {
        type: "string",
        enum: ["Meccan", "Medinan"],
        description: "Source-authenticated revelation place.",
      },
      verses: {
        type: "array",
        items: VERSE,
        minItems: 1,
        description: "Bounded Quran verses.",
      },
      meaning: facts.meaning,
      sources: {
        type: "object",
        properties: {
          arabic: embeddedSource("tanzil-text"),
          translation: translationSource(facts.translationId, locale),
        },
        required: ["arabic", "translation"],
        additionalProperties: true,
      },
      tafsir_access: facts.tafsir,
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
}
