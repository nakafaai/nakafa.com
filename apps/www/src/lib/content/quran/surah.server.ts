import { parseQuranSurahNumber } from "@repo/backend/client/quran/route";
import { selectQuranMeaning } from "@repo/backend/content/quran/contract";
import { loadLocaleMessages } from "@repo/internationalization/src/messages";
import { toAnchorSlug } from "@repo/utilities/slug";
import { Array as Arr, Effect, Option } from "effect";
import { createTranslator } from "use-intl";
import {
  LEARN_SHELL_CACHE_SCOPES,
  readContentCacheTags,
} from "@/lib/content/delivery";
import {
  getQuranPagination,
  getQuranSurahName,
} from "@/lib/content/quran/navigation";
import {
  readPublishedQuranCatalog,
  readPublishedQuranView,
} from "@/lib/content/quran/publication";
import { recoverStalePublishedQuranSnapshot } from "@/lib/content/quran/recovery";
import { getQuranReferences } from "@/lib/content/quran/references";
import type { SurahRouteInput } from "@/lib/content/quran/surah.functions";
import { getLocaleOrThrow } from "@/lib/i18n/params";
import { getLlmsMarkdownPath } from "@/lib/llms/format";
import { createBreadcrumbItems } from "@/lib/seo/breadcrumbs";
import { resolveSEOMetadata } from "@/lib/seo/generator";
import { serverHandler } from "@/lib/server/fn";

/**
 * Reads one surah with its verses, pagination and sources on the server. A
 * route that does not name a surah of the catalog is a 404.
 */
const readSurahPage = Effect.fn("www.content.quran.readSurah")(function* (
  data: typeof SurahRouteInput.Type
) {
  const locale = getLocaleOrThrow(data.locale);
  const parsedNumber = Option.fromNullishOr(parseQuranSurahNumber(data.surah));
  if (Option.isNone(parsedNumber)) {
    return { kind: "notFound" as const };
  }
  const surahNumber = parsedNumber.value;
  const catalog = yield* readPublishedQuranCatalog();
  const surahData = Arr.findFirst(
    catalog.surahs,
    ({ number }) => number === surahNumber
  );
  if (Option.isNone(surahData)) {
    return { kind: "notFound" as const };
  }
  const [view, messages, seo] = yield* Effect.all(
    [
      readPublishedQuranView(locale, surahNumber),
      Effect.promise(() => loadLocaleMessages(locale)),
      resolveSEOMetadata({ surah: surahData.value, type: "quran" }, locale),
    ],
    { concurrency: "unbounded" }
  );
  const t = createTranslator({ locale, messages, namespace: "Holy" });
  const tCommon = createTranslator({ locale, messages, namespace: "Common" });
  const title = getQuranSurahName(view.surah.name);
  const meaning = selectQuranMeaning(view.surah.name.meaning, locale);
  const verseItems = Arr.map(view.verses, (verse) => {
    const label = t("verse-count", { count: verse.number.inSurah });
    return { id: toAnchorSlug(label), label, verse };
  });

  const preBismillah = Option.match(Option.fromNullishOr(view.preBismillah), {
    onNone: () => ({ kind: "hidden" as const }),
    onSome: (value) => ({ kind: "shown" as const, value }),
  });

  return {
    kind: "found" as const,
    arabic: view.surah.name.arabic,
    book: {
      description: meaning.text,
      name: title,
      numberOfVerses: view.surah.numberOfVerses,
      position: surahNumber,
    },
    breadcrumbs: createBreadcrumbItems(locale, [
      { name: tCommon("home"), path: "" },
      { name: t("quran"), path: "/quran" },
      { name: title, path: `/quran/${data.surah}` },
    ]),
    cacheTags: readContentCacheTags(
      [...LEARN_SHELL_CACHE_SCOPES, "quran"],
      [view.snapshotId]
    ),
    copySourceUrl: getLlmsMarkdownPath({
      locale,
      publicPath: `quran/${data.surah}`,
    }),
    description: seo.description,
    headings: Arr.map(verseItems, ({ id, label }) => ({
      children: [],
      href: `#${id}`,
      label,
    })),
    labels: {
      home: tCommon("home"),
      more: tCommon("more"),
      quran: t("quran"),
      verse: t("verse"),
    },
    interpretationLabel: t("interpretation"),
    locale,
    meaning: { appLocale: meaning.appLocale, text: meaning.text },
    pagination: getQuranPagination({
      nextSurah: view.nextSurah,
      prevSurah: view.previousSurah,
    }),
    preBismillah,
    references: getQuranReferences(view.sources, view.tafsirAccess),
    snapshotId: view.snapshotId,
    surah: data.surah,
    surahNumber,
    tafsirAccess: view.tafsirAccess,
    title,
    translationNotesLabel: t("translation-notes"),
    verseItems,
  };
});

/** The surah route's server function answer: the read, stopped when the visitor leaves. */
export const readSurahHandler = serverHandler(readSurahPage);

/**
 * Recovers a stale interpretation snapshot. The reader that served it asks once,
 * and the recovery decides, so the answer never names another snapshot.
 */
const recoverQuranSnapshotPage = Effect.fn("www.content.quran.recoverSnapshot")(
  function* (data: { readonly snapshotId: string }) {
    return yield* recoverStalePublishedQuranSnapshot(data.snapshotId);
  }
);

/** The recovery server function's answer, stopped when the visitor leaves. */
export const recoverQuranSnapshotHandler = serverHandler(
  recoverQuranSnapshotPage
);
