import {
  type AppLocaleCode,
  ENGLISH_APP_LOCALE_CODE,
} from "@nakafa/aksara-contracts/locale";
import {
  type QuranEmbeddedSourceId,
  type QuranExternalSourceId,
  quranTranslationSourceId,
} from "@nakafa/aksara-contracts/quran/identity";
import { NakafaAgentQuranReferenceV2Schema } from "@repo/contents/_lib/agent/schema/quran/reference";
import { Schema } from "effect";
import { describe, expect, it } from "vitest";

const ARTIFACT = {
  byte_count: 1,
  digest: `sha256:${"1".repeat(64)}`,
  file_count: 1,
};

/** Builds one schema-valid embedded source fixture. */
function embeddedSource(id: QuranEmbeddedSourceId) {
  return {
    artifact: ARTIFACT,
    id,
    kind: "embedded",
    label: `Technical ${id}`,
    notice: `Technical ${id} notice.`,
    publisher: "Technical publisher",
    retrieved_at: "2026-08-26T15:51:00Z",
    source_url: `https://example.test/${id}`,
    terms: {
      artifact: ARTIFACT,
      url: `https://example.test/${id}/terms`,
    },
    update_url: `https://example.test/${id}/updates`,
    version: "technical-version",
  };
}

/** Builds one schema-valid external source fixture. */
function externalSource(id: QuranExternalSourceId) {
  return {
    id,
    kind: "external",
    label: `Technical ${id}`,
    notice: `Technical ${id} notice.`,
    publisher: "Technical publisher",
    retrieved_at: "2026-08-26T15:51:00Z",
    source_url: `https://example.test/${id}`,
    terms: {
      access: "link-only",
      url: `https://example.test/${id}/terms`,
    },
    update_url: `https://example.test/${id}/updates`,
    version: "technical-version",
  };
}

/** Builds one complete V2 reference for an explicit tafsir access record. */
function reference(appLocale: AppLocaleCode, tafsir_access: unknown) {
  return {
    alignmentId: "alignment:quran:quran-surah:1",
    assetId: `asset:${appLocale}:quran:quran-surah:1`,
    conceptId: "concept:quran:surah:1",
    content_id: `asset:${appLocale}:quran:quran-surah:1`,
    learningObjectId: "lo:quran-surah:1",
    lensId: "lens:quran",
    locale: appLocale,
    markdown_url: `https://nakafa.com/${appLocale}/quran/1.md`,
    meaning:
      appLocale === ENGLISH_APP_LOCALE_CODE
        ? { locale: ENGLISH_APP_LOCALE_CODE, text: "The Opening" }
        : null,
    name: "Al-Fatihah",
    revelation: "Meccan",
    sources: {
      arabic: embeddedSource("tanzil-text"),
      translation: {
        ...embeddedSource(quranTranslationSourceId(appLocale)),
        locale: appLocale,
      },
    },
    tafsir_access,
    route: "quran/1",
    section: "quran",
    url: `https://nakafa.com/${appLocale}/quran/1`,
    verses: [
      {
        arabic: "بِسْمِ اللّٰهِ",
        number: 1,
        translation: {
          notes: [
            { number: 4, referenceOffset: 19, text: "Exact source note." },
          ],
          segments: [
            { kind: "text", offset: 0, value: "In the name of Allah." },
            { kind: "note", number: 4, offset: 19 },
          ],
        },
      },
    ],
  };
}

describe("NakafaAgentQuranReferenceV2Schema", () => {
  it("accepts explicit English meaning and external tafsir access", () => {
    const decoded = Schema.decodeUnknownSync(NakafaAgentQuranReferenceV2Schema)(
      reference("en", {
        kind: "external",
        locale: "en",
        notice: "Read the official linked English edition.",
        source: externalSource("mokhtasar-english"),
      }),
      { onExcessProperty: "error" }
    );

    expect(decoded.meaning).toEqual({ locale: "en", text: "The Opening" });
    expect(decoded.tafsir_access.source.id).toBe("mokhtasar-english");
    expect(decoded.verses[0]?.translation.segments[1]).toEqual({
      kind: "note",
      number: 4,
      offset: 19,
    });
  });

  it("accepts Indonesian embedded and German external tafsir identities", () => {
    const indonesian = reference("id", {
      kind: "embedded",
      locale: "id",
      notice: "Tafsir Indonesia is embedded.",
      source: embeddedSource("quranenc-tafsir"),
    });
    const german = reference("de", {
      kind: "external",
      locale: "de",
      notice: "Read the official linked German edition.",
      source: externalSource("mokhtasar-german"),
    });

    expect(Schema.is(NakafaAgentQuranReferenceV2Schema)(indonesian)).toBe(true);
    expect(Schema.is(NakafaAgentQuranReferenceV2Schema)(german)).toBe(true);
  });

  it("rejects source access from another otherwise valid locale", () => {
    const mismatched = reference("en", {
      kind: "external",
      locale: "de",
      notice: "Read the official linked German edition.",
      source: externalSource("mokhtasar-german"),
    });

    expect(Schema.is(NakafaAgentQuranReferenceV2Schema)(mismatched)).toBe(
      false
    );
  });

  it("rejects translation provenance from another locale", () => {
    const mismatched = reference("en", {
      kind: "external",
      locale: "en",
      notice: "Read the official linked English edition.",
      source: externalSource("mokhtasar-english"),
    });
    mismatched.sources.translation = {
      ...embeddedSource("quranenc-german"),
      locale: "de",
    };

    expect(Schema.is(NakafaAgentQuranReferenceV2Schema)(mismatched)).toBe(
      false
    );
  });
});
