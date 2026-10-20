import { parseQuranSurahNumber } from "@repo/backend/client/quran/route";
import { selectQuranMeaning } from "@repo/backend/content/quran/contract";
import { loadLocaleMessages } from "@repo/internationalization/src/messages";
import { COMPANY_IDENTITY } from "@repo/seo/company";
import { makeBookNode, makeBreadcrumbNodes } from "@repo/seo/json-ld/node";
import { toAnchorSlug } from "@repo/utilities/slug";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { Array as Arr, Effect, Option, Schema } from "effect";
import { createTranslator } from "use-intl";
import { SheetEntry } from "@/components/ai/sheet/entry";
import { AiMenuItem } from "@/components/ai/sheet/menu";
import { OpenContent } from "@/components/shared/content/actions";
import { LayoutContent } from "@/components/shared/content/layout";
import { PaginationContent } from "@/components/shared/content/pagination";
import { FragmentLanding } from "@/components/shared/fragment";
import { LayoutMaterialContent } from "@/components/shared/material/content";
import { LayoutMaterial } from "@/components/shared/material/layout";
import {
  SidebarRightFooter,
  SidebarRightHeader,
  SidebarRightPanel,
  SidebarRightProvider,
} from "@/components/shared/outline/panel";
import { SidebarTree } from "@/components/shared/outline/tree";
import { QuranBismillah } from "@/components/shared/quran/bismillah";
import { QuranSurahHeader } from "@/components/shared/quran/header";
import { QuranInterpretationControls } from "@/components/shared/quran/interpretation/controls";
import { QuranSurahName } from "@/components/shared/quran/name";
import { QuranVersesProvider } from "@/components/shared/quran/verses/context";
import { QuranVerseList } from "@/components/shared/quran/verses/list";
import { ReferenceButton } from "@/components/sidebar/actions/reference";
import { ReportButton } from "@/components/sidebar/actions/report";
import { ShareButton } from "@/components/sidebar/actions/share";
import {
  LEARN_SHELL_CACHE_SCOPES,
  publicContentHeaders,
  readContentCacheTags,
} from "@/lib/content/delivery";
import {
  getQuranPagination,
  getQuranSurahName,
} from "@/lib/content/quran/navigation";
import {
  getPublishedQuranCatalog,
  getPublishedQuranView,
} from "@/lib/content/quran/publication";
import { recoverStalePublishedQuranSnapshot } from "@/lib/content/quran/recovery";
import { getQuranReferences } from "@/lib/content/quran/references";
import { getLocaleOrThrow } from "@/lib/i18n/params";
import { getLlmsMarkdownPath } from "@/lib/llms/format";
import { getAppSocialArtwork } from "@/lib/og/app";
import { createBreadcrumbItems } from "@/lib/seo/breadcrumbs";
import { generateSEOMetadata } from "@/lib/seo/generator";
import { createSeoHead, toRouterHead } from "@/lib/seo/head";
import { runServerEffect } from "@/lib/server/fn";

const SurahInput = Schema.Struct({
  locale: Schema.String,
  surah: Schema.String,
});

/**
 * Reads one surah with its verses, pagination and sources on the server. A
 * route that does not name a surah of the catalog is a 404.
 */
const readSurah = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(SurahInput))
  .handler(async ({ data }) => {
    const locale = getLocaleOrThrow(data.locale);
    const surahNumber = parseQuranSurahNumber(data.surah);
    if (surahNumber === null) {
      return { kind: "notFound" as const };
    }
    const catalog = await getPublishedQuranCatalog();
    const surahData = Arr.findFirst(
      catalog.surahs,
      ({ number }) => number === surahNumber
    );
    if (Option.isNone(surahData)) {
      return { kind: "notFound" as const };
    }
    const [view, messages, seo] = await Promise.all([
      getPublishedQuranView(locale, surahNumber),
      loadLocaleMessages(locale),
      Effect.runPromise(
        generateSEOMetadata({ surah: surahData.value, type: "quran" }, locale)
      ),
    ]);
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

/**
 * Recovers a stale interpretation snapshot. The reader that served it asks once,
 * and the recovery decides, so the answer never names another snapshot.
 */
const recoverQuranSnapshot = createServerFn({ method: "POST" })
  .validator(
    Schema.toStandardSchemaV1(Schema.Struct({ snapshotId: Schema.String }))
  )
  .handler(({ data }) =>
    runServerEffect(recoverStalePublishedQuranSnapshot(data.snapshotId))
  );

/** One surah: its verses, its interpretation controls and its outline. */
export const Route = createFileRoute("/$locale/_main/quran/$surah")({
  loader: async ({ params }) => {
    const surah = await readSurah({
      data: { locale: params.locale, surah: params.surah },
    });
    if (surah.kind === "notFound") {
      throw notFound();
    }
    return surah;
  },
  head: ({ loaderData }) => {
    if (loaderData === undefined) {
      return {};
    }
    const { book, breadcrumbs, description, locale, surah, title } = loaderData;
    return toRouterHead(
      createSeoHead({
        canonicalPath: `/${locale}/quran/${surah}`,
        description,
        image: getAppSocialArtwork({
          key: "quran",
          locale,
          publicPath: "quran",
        }),
        indexable: true,
        jsonLd: [
          ...makeBreadcrumbNodes(breadcrumbs),
          makeBookNode({
            author: { "@type": "Person", name: "Allah" },
            description: book.description,
            inLanguage: locale,
            name: book.name,
            position: book.position,
            totalPages: book.numberOfVerses,
            url: `${COMPANY_IDENTITY.url}/${locale}/quran/${surah}`,
          }),
        ],
        locale,
        parts: [title],
        type: "book",
      })
    );
  },
  headers: ({ loaderData }) =>
    loaderData === undefined
      ? undefined
      : publicContentHeaders(loaderData.cacheTags),
  component: QuranSurahPage,
});

function QuranSurahPage() {
  const page = Route.useLoaderData();
  const { labels } = page;

  async function recoverSnapshot() {
    await recoverQuranSnapshot({ data: { snapshotId: page.snapshotId } });
  }

  return (
    <LayoutMaterial>
      <SidebarRightProvider>
        <LayoutMaterialContent>
          <QuranSurahHeader
            actions={
              <OpenContent
                copySourceUrl={page.copySourceUrl}
                slug={`/${page.locale}/quran/${page.surah}`}
              >
                <AiMenuItem contextTitle={page.title} />
              </OpenContent>
            }
            meaning={page.meaning.text}
            meaningLanguage={page.meaning.appLocale}
            name={<QuranSurahName arabic={page.arabic} title={page.title} />}
            quranLabel={labels.quran}
            title={page.title}
          />
          <LayoutContent className="pt-6">
            <QuranVersesProvider
              interpretationLabel={page.interpretationLabel}
              surahTitle={page.title}
              tafsirAccess={page.tafsirAccess}
              translationNotesLabel={page.translationNotesLabel}
            >
              {page.preBismillah.kind === "shown" ? (
                <QuranBismillah bismillah={page.preBismillah.value} />
              ) : null}
              {page.tafsirAccess.kind === "embedded" ? (
                <QuranInterpretationControls
                  appLocale={page.tafsirAccess.appLocale}
                  errorMessage={{
                    description: "interpretation-error.description",
                    title: "interpretation-error.title",
                  }}
                  label={page.interpretationLabel}
                  recoverSnapshot={recoverSnapshot}
                  refreshingMessage={{
                    description: "interpretation-refreshing.description",
                    title: "interpretation-refreshing.title",
                  }}
                  snapshotId={page.snapshotId}
                  surahNumber={page.surahNumber}
                >
                  <QuranVerseList items={page.verseItems} />
                </QuranInterpretationControls>
              ) : (
                <QuranVerseList items={page.verseItems} />
              )}
              <FragmentLanding />
            </QuranVersesProvider>
          </LayoutContent>
          <PaginationContent pagination={page.pagination} />
          <SheetEntry key={`assistant:${page.surah}`} />
        </LayoutMaterialContent>
        <SidebarRightPanel
          footer={
            <SidebarRightFooter>
              <ReferenceButton
                references={page.references}
                title={page.title}
              />
              <ReportButton />
              <ShareButton />
            </SidebarRightFooter>
          }
          header={
            <SidebarRightHeader
              description={page.meaning.text}
              descriptionLanguage={page.meaning.appLocale}
              href={`/quran/${page.surah}`}
              title={page.title}
            />
          }
        >
          <SidebarTree data={page.headings} title={labels.verse} />
        </SidebarRightPanel>
      </SidebarRightProvider>
    </LayoutMaterial>
  );
}
