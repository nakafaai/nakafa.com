import type { QuranTranslationDocument } from "@nakafa/aksara-contracts/quran/notes";
import { QuranSurahNumberSchema } from "@nakafa/aksara-contracts/quran/spec";
import { projectQuranTranslation } from "@repo/backend/client/quran/notes";
import { parseQuranSurahNumber } from "@repo/backend/client/quran/route";
import { formatQuranMeaning } from "@repo/backend/content/quran/contract";
import { loadLocaleMessages } from "@repo/internationalization/src/messages";
import { Array as Arr, Effect, Option, Schema } from "effect";
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
const QuranLlmsRouteSchema = Schema.Union([
  Schema.Struct({ kind: Schema.Literal("index") }),
  Schema.Struct({
    kind: Schema.Literal("surah"),
    surahNumber: QuranSurahNumberSchema,
  }),
]);

type QuranLlmsRoute = typeof QuranLlmsRouteSchema.Type;

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
      rows: Arr.map(surahs, (surah) => ({
        description: formatQuranMeaning(surah.name.meaning, locale),
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
  const header = buildHeader({
    description: t("quran-description"),
    title: t("quran"),
    url: `${BASE_URL}/${locale}/quran`,
  });
  const surahLines = Arr.flatMap(surahs, (surah) => {
    const title = getQuranSurahName(surah.name);
    return [
      `## ${surah.number}. ${title}`,
      "",
      `**${t("meaning")}:** ${formatQuranMeaning(surah.name.meaning, locale)}`,
      "",
      `**${t("revelation")}:** ${t("revelation-place", {
        place: surah.revelation.place,
      })}`,
      "",
      `**${t("number-of-verses")}:** ${surah.numberOfVerses}`,
      "",
    ];
  });

  return Arr.join([...header, ...surahLines], "\n");
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
  const description = formatQuranMeaning(surah.name.meaning, locale);
  const header = buildHeader({
    description,
    title,
    url: `${BASE_URL}/${locale}/quran/${surahNumber}`,
  });
  const summaryLines = [
    `## ${title}`,
    "",
    `**${t("meaning")}:** ${formatQuranMeaning(surah.name.meaning, locale)}`,
    `**${t("revelation")}:** ${t("revelation-place", {
      place: surah.revelation.place,
    })}`,
    `**${t("number-of-verses")}:** ${surah.numberOfVerses}`,
    "",
    `### ${t("sources")}`,
    "",
    `- **${t("arabic-source")}:** [${markdown.sources.arabic.label}](${markdown.sources.arabic.sourceUrl})`,
    `  ${markdown.sources.arabic.notice}`,
    `  ${markdown.sources.arabic.publisher} · ${markdown.sources.arabic.version}`,
    `- **${t("translation-source")}:** [${markdown.sources.translation.label}](${markdown.sources.translation.sourceUrl})`,
    `  ${markdown.sources.translation.notice}`,
    `  ${markdown.sources.translation.publisher} · ${markdown.sources.translation.version}`,
    "",
    tafsirAccess.notice,
    "",
    `[${tafsirAccess.source.label}](${tafsirAccess.source.sourceUrl})`,
    "",
    `### ${t("verses")}`,
    "",
  ];
  const preBismillahLines =
    markdown.preBismillah === null
      ? []
      : [
          markdown.preBismillah.arabic,
          "",
          ...renderQuranTranslation(
            markdown.preBismillah.translation,
            t("translation"),
            t("translation-notes")
          ),
          "",
        ];
  const verseLines = Arr.flatMap(markdown.verses, (verse) => [
    `#### ${t("verse")} ${verse.number.inSurah}`,
    "",
    verse.arabic,
    "",
    ...renderQuranTranslation(
      verse.translation,
      t("translation"),
      t("translation-notes")
    ),
    "",
  ]);
  const limitLines =
    surah.numberOfVerses > markdown.toVerse
      ? [
          `_${t("markdown-limit", {
            numberOfVerses: surah.numberOfVerses,
            toVerse: markdown.toVerse,
          })}_`,
          "",
        ]
      : [];

  return Arr.join(
    [
      ...header,
      ...summaryLines,
      ...preBismillahLines,
      ...verseLines,
      ...limitLines,
    ],
    "\n"
  );
});

/** Renders one semantic translation and its localized source-note heading. */
function renderQuranTranslation(
  translation: QuranTranslationDocument,
  translationLabel: string,
  notesLabel: string
) {
  const projected = projectQuranTranslation(translation, (number) =>
    number.toString()
  );
  if (projected.notes.length === 0) {
    return [`**${translationLabel}:** ${projected.text}`];
  }
  return [
    `**${translationLabel}:** ${projected.text}`,
    "",
    `**${notesLabel}:**`,
    ...Arr.map(projected.notes, (note) => `- **${note.number}.** ${note.text}`),
  ];
}
