import { COMPANY_IDENTITY } from "@repo/seo/company";
import { makeBreadcrumbNodes, makeSurahNode } from "@repo/seo/jsonld/node";
import { createFileRoute, notFound, useRouter } from "@tanstack/react-router";
import { SheetEntry } from "@/components/ai/sheet/entry";
import { AiMenuItem } from "@/components/ai/sheet/menu";
import { OpenContent } from "@/components/shared/content/actions";
import { PaginationContent } from "@/components/shared/content/pagination";
import { FragmentLanding } from "@/components/shared/fragment";
import { SidebarTree } from "@/components/shared/outline/tree";
import { PageStack } from "@/components/shared/page/body";
import { Page } from "@/components/shared/page/frame";
import {
  PageOutline,
  PageOutlineFooter,
  PageOutlineHeader,
  PageOutlineProvider,
} from "@/components/shared/page/outline";
import { QuranBismillah } from "@/components/shared/quran/bismillah";
import { QuranSurahFind } from "@/components/shared/quran/find";
import { QuranSurahHeader } from "@/components/shared/quran/header";
import { QuranInterpretationControls } from "@/components/shared/quran/interpretation/controls";
import { QuranSurahsContext } from "@/components/shared/quran/surahs";
import { QuranVersesProvider } from "@/components/shared/quran/verses/context";
import { QuranVerseList } from "@/components/shared/quran/verses/list";
import { ReferenceButton } from "@/components/sidebar/actions/reference";
import { ReportButton } from "@/components/sidebar/actions/report";
import { ShareButton } from "@/components/sidebar/actions/share";
import { PUBLIC_CONTENT_HEADERS } from "@/lib/content/delivery";
import {
  readSurahFn,
  recoverQuranSnapshotFn,
} from "@/lib/content/quran/surah.functions";
import { getAppSocialArtwork } from "@/lib/og/app";
import { createSeoHead, toRouterHead } from "@/lib/seo/head";
import { readStaticData } from "@/lib/static/data";

/** One surah: its verses, its interpretation controls and its outline. */
export const Route = createFileRoute("/$locale/_main/quran/$surah")({
  loader: async ({ params }) => {
    const surah = await readStaticData(readSurahFn, {
      locale: params.locale,
      surah: params.surah,
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
    const {
      book,
      breadcrumbs,
      description,
      locale,
      meaning,
      searchTitle,
      surah,
      title,
    } = loaderData;
    return toRouterHead(
      createSeoHead({
        absoluteTitle: searchTitle,
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
          makeSurahNode({
            bookName: book.name,
            bookUrl: `${COMPANY_IDENTITY.url}/${locale}/quran`,
            description,
            inLanguage: locale,
            meaning: meaning.text,
            name: title,
            position: book.position,
            url: `${COMPANY_IDENTITY.url}/${locale}/quran/${surah}`,
          }),
        ],
        locale,
        parts: [],
        type: "book",
      })
    );
  },
  headers: ({ loaderData }) =>
    loaderData === undefined ? undefined : PUBLIC_CONTENT_HEADERS,
  component: QuranSurahPage,
});

function QuranSurahPage() {
  const page = Route.useLoaderData();
  const router = useRouter();
  const { labels } = page;

  /** Recovers a stale snapshot and reads the page again, so the next press names the snapshot that stands now. */
  async function recoverSnapshot() {
    await recoverQuranSnapshotFn({ data: { snapshotId: page.snapshotId } });
    await router.invalidate();
  }

  return (
    <PageOutlineProvider>
      <Page>
        <QuranSurahsContext value={page.surahs}>
          <QuranSurahHeader
            actions={
              <OpenContent
                copySourceUrl={page.copySourceUrl}
                slug={`/${page.locale}/quran/${page.surah}`}
              >
                <AiMenuItem contextTitle={page.title} />
              </OpenContent>
            }
            arabic={page.arabic}
            meaning={page.meaning.text}
            meaningLanguage={page.meaning.appLocale}
            quranLabel={labels.quran}
            search={<QuranSurahFind key={page.surahNumber} />}
            title={page.title}
          />
        </QuranSurahsContext>
        <PageStack>
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
        </PageStack>
        <PaginationContent pagination={page.pagination} />
        <SheetEntry key={`assistant:${page.surah}`} />
      </Page>
      <PageOutline
        footer={
          <PageOutlineFooter>
            <ReferenceButton references={page.references} />
            <ReportButton />
            <ShareButton />
          </PageOutlineFooter>
        }
        header={
          <PageOutlineHeader
            description={page.meaning.text}
            descriptionLanguage={page.meaning.appLocale}
            publicPath={`quran/${page.surah}`}
            title={page.title}
          />
        }
      >
        <SidebarTree data={page.headings} title={labels.verse} />
      </PageOutline>
    </PageOutlineProvider>
  );
}
