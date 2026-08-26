import { QuranSurahNumberSchema } from "@nakafa/aksara-contracts/quran/spec";
import { parseQuranSurahNumber } from "@repo/backend/client/quran/route";
import { Effect, Option, Schema } from "effect";
import type { Locale } from "next-intl";
import {
  readPublishedQuranCatalog,
  readPublishedQuranMarkdown,
} from "@/lib/content/quran/publication";
import { BASE_URL } from "@/lib/llms/constants";
import { buildPublishedContentLlmsEntries } from "@/lib/llms/entries";
import { buildHeader } from "@/lib/llms/format";
import { getQuranSurahName } from "@/lib/utils/pages/quran";

const QURAN_PAGE_MARKDOWN_VERSE_LIMIT = 80;

/** One canonical Quran route whose Markdown body is owned by this module. */
export const QuranLlmsRouteSchema = Schema.Union([
  Schema.Struct({ kind: Schema.Literal("index") }),
  Schema.Struct({
    kind: Schema.Literal("surah"),
    surahNumber: QuranSurahNumberSchema,
  }),
]);

export type QuranLlmsRoute = Schema.Schema.Type<typeof QuranLlmsRouteSchema>;

/** Classifies Quran Markdown ownership without reading publication body data. */
export function classifyQuranLlmsRoute(
  cleanSlug: string
): Option.Option<QuranLlmsRoute> {
  const [root, rawSurahNumber, ...extraSegments] = cleanSlug.split("/");
  if (root !== "quran" || extraSegments.length > 0) {
    return Option.none();
  }

  if (rawSurahNumber === undefined) {
    return Option.some({ kind: "index" });
  }

  const surahNumber = Option.fromNullOr(parseQuranSurahNumber(rawSurahNumber));
  if (Option.isNone(surahNumber)) {
    return Option.none();
  }

  return Option.some({ kind: "surah", surahNumber: surahNumber.value });
}

/** Reads the complete bounded signed inventory used by Quran indexes. */
export const readQuranLlmsInventory = Effect.fn("www.llms.quran.inventory")(
  function* () {
    const { surahs } = yield* readPublishedQuranCatalog();
    return {
      pageCount: surahs.length === 0 ? 0 : 1,
      routeCount: surahs.length,
    };
  }
);

/** Builds the one bounded page of signed Quran links for a locale. */
export const readQuranLlmsPageEntries = Effect.fn("www.llms.quran.pageEntries")(
  function* (locale: Locale, page: number) {
    const { surahs } = yield* readPublishedQuranCatalog();
    if (page !== 0 || surahs.length === 0) {
      return null;
    }

    return buildPublishedContentLlmsEntries({
      locale,
      rows: surahs.map((surah) => ({
        description: surah.name.translation,
        publicPath: `quran/${surah.number}`,
        title: getQuranSurahName(surah.name),
      })),
      section: "quran",
    });
  }
);

/** Builds markdown for the Quran list or one surah page. */
export const getQuranLlmsText = Effect.fn("www.llms.quran.text")(function* ({
  cleanSlug,
  locale,
}: {
  cleanSlug: string;
  locale: Locale;
}) {
  const route = classifyQuranLlmsRoute(cleanSlug);
  if (Option.isNone(route)) {
    return null;
  }

  if (route.value.kind === "index") {
    return yield* getQuranIndexText(locale);
  }

  return yield* getSurahLlmsText({
    locale,
    surahNumber: route.value.surahNumber,
  });
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
    const markdown = yield* readPublishedQuranMarkdown(
      locale,
      surahNumber,
      QURAN_PAGE_MARKDOWN_VERSE_LIMIT
    );
    const surah = markdown.surah;
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

    for (const verse of markdown.verses) {
      scanned.push(`#### Verse ${verse.number.inSurah}`);
      scanned.push("");
      scanned.push(verse.arabic);
      scanned.push("");
      scanned.push(`**Translation:** ${verse.translation.text}`);
      const footnotes = verse.translation.footnotes;
      if (footnotes) {
        scanned.push("");
        scanned.push(`**Translation notes:** ${footnotes}`);
      }
      scanned.push("");
    }

    if (surah.numberOfVerses > markdown.toVerse) {
      scanned.push(
        `_This page-level markdown is bounded to verses 1-${markdown.toVerse} of ${surah.numberOfVerses}. Use the Nakafa Quran reference tool for exact verse ranges._`
      );
      scanned.push("");
    }

    return scanned.join("\n");
  });
}
