import type { ActiveAppLocaleCode } from "@nakafa/aksara-contracts/locale";
import {
  type QuranEmbeddedSourceId,
  type QuranExternalSourceId,
  quranTafsirSourceId,
  quranTranslationSourceId,
} from "@nakafa/aksara-contracts/quran/identity";
import { readNakafaContentRefFixture } from "@repo/contents/_lib/agent/fixture";
import { NakafaAgentQuranReferenceSchema } from "@repo/contents/_lib/agent/schema/quran/reference";
import { Schema } from "effect";

const ARTIFACT = {
  byte_count: 1,
  digest: `sha256:${"1".repeat(64)}`,
  file_count: 1,
};
const meaningByLocale = {
  de: "Die Eröffnende",
  en: "The Opening",
  id: "Pembuka",
} as const;
/** Builds one complete embedded source for injected results. */
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
    terms: { artifact: ARTIFACT, url: `https://example.test/${id}/terms` },
    update_url: `https://example.test/${id}/updates`,
    version: "technical-version",
  };
}

/** Builds one complete link-only source for injected results. */
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

/** Builds exact locale-correlated tafsir access. */
function tafsirAccess(locale: ActiveAppLocaleCode) {
  if (locale === "id") {
    return {
      kind: "embedded",
      locale,
      notice: "Technical id tafsir access.",
      source: embeddedSource(quranTafsirSourceId(locale)),
    };
  }
  if (locale === "de") {
    return {
      kind: "external",
      locale,
      notice: "Technical de tafsir access.",
      source: externalSource(quranTafsirSourceId(locale)),
    };
  }
  return {
    kind: "external",
    locale,
    notice: `Technical ${locale} tafsir access.`,
    source: externalSource(quranTafsirSourceId(locale)),
  };
}

/** Decodes one source-grounded reference used by injected AI tests. */
export function makeQuranFixture(input: {
  readonly from_verse: number;
  readonly include_tafsir: boolean;
  readonly locale: ActiveAppLocaleCode;
  readonly surah: number;
}) {
  const { from_verse, include_tafsir, locale, surah } = input;
  return Schema.decodeUnknownSync(NakafaAgentQuranReferenceSchema)({
    ...readNakafaContentRefFixture(locale, `quran/${surah}`, "quran"),
    meaning: { locale, text: meaningByLocale[locale] },
    name: "Al-Faatiha",
    pre_bismillah: null,
    revelation: "Meccan",
    sources: {
      arabic: embeddedSource("tanzil-text"),
      translation: {
        ...embeddedSource(quranTranslationSourceId(locale)),
        locale,
      },
    },
    tafsir_access: tafsirAccess(locale),
    verses: [
      {
        arabic: "بِسْمِ اللّٰهِ الرَّحْمٰنِ الرَّحِيْمِ",
        number: from_verse,
        ...(include_tafsir && locale === "id"
          ? { tafsir: "Tafsir from the injected test adapter." }
          : {}),
        translation: {
          notes: [],
          segments: [
            { kind: "text", offset: 0, value: "In the name of Allah." },
          ],
        },
      },
    ],
  });
}
