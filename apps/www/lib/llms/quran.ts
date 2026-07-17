import { Effect } from "effect";
import type { Locale } from "next-intl";
import {
  getRuntimeQuranSurahPage,
  getRuntimeQuranSurahs,
} from "@/lib/content/runtime/pages";
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

  const surahNumber = Number(parts[1]);
  if (Number.isNaN(surahNumber)) {
    return null;
  }

  return yield* getSurahLlmsText({ locale, surahNumber });
});

/** Builds markdown for the Quran surah index page. */
function getQuranIndexText(locale: Locale) {
  return Effect.gen(function* () {
    const surahs = yield* getRuntimeQuranSurahs();
    const scanned = buildHeader({
      url: `${BASE_URL}/${locale}/quran`,
      description: "Al-Quran - List of all 114 Surahs in the Holy Quran.",
    });

    for (const surah of surahs) {
      const title = getQuranSurahName({ locale, name: surah.name });
      const translation = surah.name.translation[locale];
      scanned.push(`## ${surah.number}. ${title}`);
      scanned.push("");
      scanned.push(`**Translation:** ${translation}`);
      scanned.push("");
      scanned.push(`**Revelation:** ${surah.revelation[locale]}`);
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
    const page = yield* getRuntimeQuranSurahPage({ surah: surahNumber });

    if (!page) {
      return null;
    }

    const surah = page.surahData;
    const title = getQuranSurahName({ locale, name: surah.name });
    const translation = surah.name.translation[locale];
    const scanned = buildHeader({
      url: `${BASE_URL}/${locale}/quran/${surahNumber}`,
      description: `Al-Quran - Surah ${title} (${translation})`,
    });

    scanned.push(`## ${title}`);
    scanned.push("");
    scanned.push(`**Translation:** ${translation}`);
    scanned.push(`**Revelation:** ${surah.revelation[locale]}`);
    scanned.push(`**Number of Verses:** ${surah.numberOfVerses}`);
    scanned.push("");

    if (surah.preBismillah) {
      scanned.push("### Pre-Bismillah");
      scanned.push("");
      scanned.push(surah.preBismillah.text.arab);
      scanned.push("");
      scanned.push(`*${surah.preBismillah.translation[locale]}*`);
      scanned.push("");
    }

    scanned.push("### Verses");
    scanned.push("");

    for (const verse of surah.verses.slice(
      0,
      QURAN_PAGE_MARKDOWN_VERSE_LIMIT
    )) {
      scanned.push(`#### Verse ${verse.number.inSurah}`);
      scanned.push("");
      scanned.push(verse.text.arab);
      scanned.push("");
      scanned.push(`**Transliteration:** ${verse.text.transliteration.en}`);
      scanned.push("");
      scanned.push(`**Translation:** ${verse.translation[locale]}`);
      scanned.push("");
    }

    if (surah.verses.length > QURAN_PAGE_MARKDOWN_VERSE_LIMIT) {
      scanned.push(
        `_This page-level markdown is bounded to verses 1-${QURAN_PAGE_MARKDOWN_VERSE_LIMIT} of ${surah.numberOfVerses}. Use the Nakafa Quran reference tool for exact verse ranges._`
      );
      scanned.push("");
    }

    return scanned.join("\n");
  });
}
