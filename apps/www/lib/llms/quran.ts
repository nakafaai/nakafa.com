import { getAllSurah, getSurah, getSurahName } from "@repo/contents/_lib/quran";
import { Effect } from "effect";
import type { Locale } from "next-intl";
import { BASE_URL } from "@/lib/llms/constants";
import {
  buildHeader,
  formatRouteTitle,
  getTranslation,
} from "@/lib/llms/format";

/** Builds llms index metadata for Quran list and Surah routes. */
export function getQuranRouteMetadata({
  locale,
  route,
}: {
  locale: Locale;
  route: string;
}) {
  if (route === "/quran") {
    return {
      description: "List of all 114 Surahs in the Holy Quran.",
      hasMarkdown: true,
      title: "Al-Quran",
    };
  }

  const surahNumber = Number(route.split("/").at(-1));
  const surah = getAllSurah().find((item) => item.number === surahNumber);

  if (!surah) {
    return {
      description: undefined,
      hasMarkdown: false,
      title: formatRouteTitle(route),
    };
  }

  return {
    description: getTranslation(surah.name.translation, locale),
    hasMarkdown: true,
    title: `${surah.number}. ${getSurahName({ locale, name: surah.name })}`,
  };
}

/** Builds markdown for the Quran list or one Surah page. */
export function getQuranLlmsText({
  cleanSlug,
  locale,
}: {
  cleanSlug: string;
  locale: Locale;
}) {
  if (!cleanSlug.startsWith("quran")) {
    return null;
  }

  const parts = cleanSlug.split("/");

  if (parts.length === 1) {
    return getQuranIndexText(locale);
  }

  if (parts.length !== 2) {
    return null;
  }

  const surahNumber = Number(parts[1]);
  if (Number.isNaN(surahNumber)) {
    return null;
  }

  return getSurahLlmsText({ locale, surahNumber });
}

/** Builds markdown for the Quran Surah index page. */
function getQuranIndexText(locale: Locale) {
  const scanned = buildHeader({
    url: `${BASE_URL}/${locale}/quran`,
    description: "Al-Quran - List of all 114 Surahs in the Holy Quran.",
  });

  for (const surah of getAllSurah()) {
    const title = getSurahName({ locale, name: surah.name });
    const translation = getTranslation(surah.name.translation, locale);
    scanned.push(`## ${surah.number}. ${title}`);
    scanned.push("");
    scanned.push(`**Translation:** ${translation}`);
    scanned.push("");
    scanned.push(`**Revelation:** ${surah.revelation.en}`);
    scanned.push("");
    scanned.push(`**Number of Verses:** ${surah.numberOfVerses}`);
    scanned.push("");
  }

  return scanned.join("\n");
}

/** Builds markdown for one Surah and its verses. */
function getSurahLlmsText({
  locale,
  surahNumber,
}: {
  locale: Locale;
  surahNumber: number;
}) {
  const surah = Effect.runSync(
    Effect.match(getSurah(surahNumber), {
      onFailure: () => null,
      onSuccess: (data) => data,
    })
  );

  if (!surah) {
    return null;
  }

  const title = getSurahName({ locale, name: surah.name });
  const translation = getTranslation(surah.name.translation, locale);
  const scanned = buildHeader({
    url: `${BASE_URL}/${locale}/quran/${surahNumber}`,
    description: `Al-Quran - Surah ${title} (${translation})`,
  });

  scanned.push(`## ${title}`);
  scanned.push("");
  scanned.push(`**Translation:** ${translation}`);
  scanned.push(`**Revelation:** ${surah.revelation.en}`);
  scanned.push(`**Number of Verses:** ${surah.numberOfVerses}`);
  scanned.push("");

  if (surah.preBismillah) {
    scanned.push("### Pre-Bismillah");
    scanned.push("");
    scanned.push(surah.preBismillah.text.arab);
    scanned.push("");
    scanned.push(`*${getTranslation(surah.preBismillah.translation, locale)}*`);
    scanned.push("");
  }

  scanned.push("### Verses");
  scanned.push("");

  for (const verse of surah.verses) {
    scanned.push(`#### Verse ${verse.number.inSurah}`);
    scanned.push("");
    scanned.push(verse.text.arab);
    scanned.push("");
    scanned.push(`**Transliteration:** ${verse.text.transliteration.en}`);
    scanned.push("");
    scanned.push(
      `**Translation:** ${getTranslation(verse.translation, locale)}`
    );
    scanned.push("");
  }

  return scanned.join("\n");
}
