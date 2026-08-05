import { parseQuranSurahNumber } from "@repo/backend/client/quran/route";
import { Effect } from "effect";
import type { Locale } from "next-intl";
import {
  readPublishedQuranCatalog,
  readPublishedQuranPage,
} from "@/lib/content/quran/publication";
import { BASE_URL } from "@/lib/llms/constants";
import { buildHeader } from "@/lib/llms/format";
import { getQuranSurahName } from "@/lib/utils/pages/quran";

const QURAN_PAGE_MARKDOWN_VERSE_LIMIT = 80;

/** Builds markdown for the Quran list or one surah page. */
export const getQuranLlmsText = Effect.fn("www.llms.quran.text")(function* ({
  cleanSlug,
  locale,
}: {
  cleanSlug: string;
  locale: Locale;
}) {
  if (cleanSlug !== "quran" && !cleanSlug.startsWith("quran/")) {
    return null;
  }

  const parts = cleanSlug.split("/");

  if (parts.length === 1) {
    return yield* getQuranIndexText(locale);
  }

  if (parts.length !== 2) {
    return null;
  }

  const surahNumber = parseQuranSurahNumber(parts[1]);
  if (surahNumber === null) {
    return null;
  }

  return yield* getSurahLlmsText({ locale, surahNumber });
});

/** Builds markdown for the Quran surah index page. */
function getQuranIndexText(locale: Locale) {
  return Effect.gen(function* () {
    const { surahs } = yield* readPublishedQuranCatalog();
    const scanned = buildHeader({
      description: "Al-Quran - List of all 114 Surahs in the Holy Quran.",
      title: "Al-Quran",
      url: `${BASE_URL}/${locale}/quran`,
    });

    for (const surah of surahs) {
      const title = getQuranSurahName(surah.name);
      const translation = surah.name.translation;
      scanned.push(`## ${surah.number}. ${title}`);
      scanned.push("");
      scanned.push(`**Translation:** ${translation}`);
      scanned.push("");
      scanned.push(`**Revelation:** ${surah.revelation.place}`);
      scanned.push("");
      scanned.push(`**Number of Verses:** ${surah.numberOfVerses}`);
      scanned.push("");
    }

    return scanned.join("\n");
  });
}

/** Builds markdown for one surah and its verses. */
function getSurahLlmsText({
  locale,
  surahNumber,
}: {
  locale: Locale;
  surahNumber: number;
}) {
  return Effect.gen(function* () {
    const page = yield* readPublishedQuranPage(locale, surahNumber);
    const surah = page.surah;
    const title = getQuranSurahName(surah.name);
    const translation = surah.name.translation;
    const scanned = buildHeader({
      description: `Al-Quran - Surah ${title} (${translation})`,
      title,
      url: `${BASE_URL}/${locale}/quran/${surahNumber}`,
    });

    scanned.push(`## ${title}`);
    scanned.push("");
    scanned.push(`**Translation:** ${translation}`);
    scanned.push(`**Revelation:** ${surah.revelation.place}`);
    scanned.push(`**Number of Verses:** ${surah.numberOfVerses}`);
    scanned.push("");

    scanned.push("### Verses");
    scanned.push("");

    for (const verse of page.verses.slice(0, QURAN_PAGE_MARKDOWN_VERSE_LIMIT)) {
      scanned.push(`#### Verse ${verse.number.inSurah}`);
      scanned.push("");
      scanned.push(verse.text.arabic);
      scanned.push("");
      scanned.push(`**Translation:** ${verse.translation[locale].text}`);
      const footnotes = verse.translation[locale].footnotes;
      if (footnotes) {
        scanned.push("");
        scanned.push(`**Translation notes:** ${footnotes}`);
      }
      scanned.push("");
    }

    if (page.verses.length > QURAN_PAGE_MARKDOWN_VERSE_LIMIT) {
      scanned.push(
        `_This page-level markdown is bounded to verses 1-${QURAN_PAGE_MARKDOWN_VERSE_LIMIT} of ${surah.numberOfVerses}. Use the Nakafa Quran reference tool for exact verse ranges._`
      );
      scanned.push("");
    }

    return scanned.join("\n");
  });
}
