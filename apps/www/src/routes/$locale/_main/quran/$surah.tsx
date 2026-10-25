import { COMPANY_IDENTITY } from "@repo/seo/company";
import { makeBookNode, makeBreadcrumbNodes } from "@repo/seo/json-ld/node";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { SheetEntry } from "@/components/ai/sheet/entry";
import { AiMenuItem } from "@/components/ai/sheet/menu";
import { OpenContent } from "@/components/shared/content/actions";
import { LayoutContent } from "@/components/shared/content/frame";
import { PaginationContent } from "@/components/shared/content/pagination";
import { FragmentLanding } from "@/components/shared/fragment";
import { LayoutMaterialContent } from "@/components/shared/material/content";
import { LayoutMaterial } from "@/components/shared/material/frame";
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
import { PUBLIC_CONTENT_HEADERS } from "@/lib/content/delivery";
import {
  readSurahFn,
  recoverQuranSnapshotFn,
} from "@/lib/content/quran/surah.functions";
import { getAppSocialArtwork } from "@/lib/og/app";
import { createSeoHead, toRouterHead } from "@/lib/seo/head";

/** One surah: its verses, its interpretation controls and its outline. */
export const Route = createFileRoute("/$locale/_main/quran/$surah")({
  loader: async ({ params }) => {
    const surah = await readSurahFn({
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
    loaderData === undefined ? undefined : PUBLIC_CONTENT_HEADERS,
  component: QuranSurahPage,
});

function QuranSurahPage() {
  const page = Route.useLoaderData();
  const { labels } = page;

  async function recoverSnapshot() {
    await recoverQuranSnapshotFn({ data: { snapshotId: page.snapshotId } });
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
