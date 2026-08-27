import { QuranSurahNumberSchema } from "@nakafa/aksara-contracts/quran/spec";
import { projectQuranTranslation } from "@repo/backend/client/quran/notes";
import { parseQuranSurahNumber } from "@repo/backend/client/quran/route";
import { loadLocaleMessages } from "@repo/internationalization/src/messages";
import { Effect, Option, Schema } from "effect";
import { createTranslator, type Locale } from "next-intl";
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
    const [{ surahs }, messages] = yield* Effect.all([
      readPublishedQuranCatalog(),
      Effect.promise(() => loadLocaleMessages(locale)),
    ]);
    if (page !== 0 || surahs.length === 0) {
      return null;
    }
    const t = createTranslator({ locale, messages, namespace: "Holy" });

    return buildPublishedContentLlmsEntries({
      locale,
      rows: surahs.map((surah) => ({
        description:
          surah.name.meaning.appLocale === locale
            ? surah.name.meaning.text
            : t("quran-description"),
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
const getQuranIndexText = Effect.fn("www.llms.quran.indexText")(function* (
  locale: Locale
) {
  const [{ surahs }, messages] = yield* Effect.all([
    readPublishedQuranCatalog(),
    Effect.promise(() => loadLocaleMessages(locale)),
  ]);
  const t = createTranslator({ locale, messages, namespace: "Holy" });
  const scanned = buildHeader({
    description: t("quran-description"),
    title: t("quran"),
    url: `${BASE_URL}/${locale}/quran`,
  });

  for (const surah of surahs) {
    const title = getQuranSurahName(surah.name);
    scanned.push(`## ${surah.number}. ${title}`);
    scanned.push("");
    if (surah.name.meaning.appLocale === locale) {
      scanned.push(`**${t("meaning")}:** ${surah.name.meaning.text}`);
      scanned.push("");
    }
    scanned.push(
      `**${t("revelation")}:** ${t("revelation-place", {
        place: surah.revelation.place,
      })}`
    );
    scanned.push("");
    scanned.push(`**${t("number-of-verses")}:** ${surah.numberOfVerses}`);
    scanned.push("");
  }

  return scanned.join("\n");
});

/** Builds markdown for one surah and its verses. */
const getSurahLlmsText = Effect.fn("www.llms.quran.surahText")(function* ({
  locale,
  surahNumber,
}: {
  locale: Locale;
  surahNumber: number;
}) {
  const [markdown, messages] = yield* Effect.all(
    [
      readPublishedQuranMarkdown(
        locale,
        surahNumber,
        QURAN_PAGE_MARKDOWN_VERSE_LIMIT
      ),
      Effect.promise(() => loadLocaleMessages(locale)),
    ],
    { concurrency: "unbounded" }
  );
  const t = createTranslator({ locale, messages, namespace: "Holy" });
  const surah = markdown.surah;
  const tafsirAccess = markdown.tafsirAccess;
  const title = getQuranSurahName(surah.name);
  const description = surah.name.meaning ?? t("quran-description");
  const scanned = buildHeader({
    description,
    title,
    url: `${BASE_URL}/${locale}/quran/${surahNumber}`,
  });

  scanned.push(`## ${title}`);
  scanned.push("");
  if (surah.name.meaning !== null) {
    scanned.push(`**${t("meaning")}:** ${surah.name.meaning}`);
  }
  scanned.push(
    `**${t("revelation")}:** ${t("revelation-place", {
      place: surah.revelation.place,
    })}`
  );
  scanned.push(`**${t("number-of-verses")}:** ${surah.numberOfVerses}`);
  scanned.push("");
  scanned.push(`### ${t("sources")}`);
  scanned.push("");
  scanned.push(
    `- **${t("arabic-source")}:** [${markdown.sources.arabic.label}](${markdown.sources.arabic.sourceUrl})`
  );
  scanned.push(`  ${markdown.sources.arabic.notice}`);
  scanned.push(
    `  ${markdown.sources.arabic.publisher} · ${markdown.sources.arabic.version}`
  );
  scanned.push(
    `- **${t("translation-source")}:** [${markdown.sources.translation.label}](${markdown.sources.translation.sourceUrl})`
  );
  scanned.push(`  ${markdown.sources.translation.notice}`);
  scanned.push(
    `  ${markdown.sources.translation.publisher} · ${markdown.sources.translation.version}`
  );
  scanned.push("");
  if (tafsirAccess !== null) {
    scanned.push(tafsirAccess.notice);
    scanned.push("");
    scanned.push(
      `[${tafsirAccess.source.label}](${tafsirAccess.source.updateUrl})`
    );
    scanned.push("");
  }

  scanned.push(`### ${t("verses")}`);
  scanned.push("");

  if (markdown.preBismillah !== null) {
    scanned.push(markdown.preBismillah.arabic);
    scanned.push("");
    scanned.push(
      `**${t("translation")}:** ${markdown.preBismillah.translation}`
    );
    scanned.push("");
  }

  for (const verse of markdown.verses) {
    scanned.push(`#### ${t("verse")} ${verse.number.inSurah}`);
    scanned.push("");
    scanned.push(verse.arabic);
    scanned.push("");
    const translated = projectQuranTranslation(verse.translation, (number) =>
      number.toString()
    );
    scanned.push(`**${t("translation")}:** ${translated.text}`);
    if (verse.translation.notes.length > 0) {
      scanned.push("");
      scanned.push(`**${t("translation-notes")}:**`);
      for (const note of verse.translation.notes) {
        scanned.push(`- **${note.number}.** ${note.text}`);
      }
    }
    scanned.push("");
  }

  if (surah.numberOfVerses > markdown.toVerse) {
    scanned.push(
      `_${t("markdown-limit", {
        numberOfVerses: surah.numberOfVerses,
        toVerse: markdown.toVerse,
      })}_`
    );
    scanned.push("");
  }

  return scanned.join("\n");
});
