import { parseQuranSurahNumber } from "@repo/backend/client/quran/route";
import { selectQuranMeaning } from "@repo/backend/content/quran/contract";
import { COMPANY_IDENTITY } from "@repo/seo/company";
import { BookJsonLd } from "@repo/seo/json-ld/book";
import { BreadcrumbJsonLd } from "@repo/seo/json-ld/breadcrumb";
import { toAnchorSlug } from "@repo/utilities/slug";
import { Array as Arr, Effect, Option } from "effect";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { Locale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { type ReactNode, Suspense } from "react";
import { SheetEntry } from "@/components/ai/sheet/entry";
import { LayoutContent } from "@/components/shared/content/layout";
import { PaginationContent } from "@/components/shared/content/pagination";
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
import { QuranVersesProvider } from "@/components/shared/quran/verses/context";
import { QuranVerseList } from "@/components/shared/quran/verses/list";
import { ReferenceButton } from "@/components/sidebar/actions/reference";
import { ReportButton } from "@/components/sidebar/actions/report";
import { ShareButton } from "@/components/sidebar/actions/share";
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
import { createLocalizedAlternates } from "@/lib/seo/alternates";
import { createBreadcrumbItems } from "@/lib/seo/breadcrumbs";
import { getCachedSEOMetadata } from "@/lib/seo/cache";
import type { SEOContext } from "@/lib/seo/contract";
import { getSocialMetadata } from "@/lib/seo/social";

/** Builds localized Quran surah metadata only after the runtime catalog confirms the surah exists. */
export async function generateMetadata({
  params,
}: {
  params: PageProps<"/[locale]/quran/[surah]">["params"];
}): Promise<Metadata> {
  const { locale: rawLocale, surah } = await params;
  const locale = getLocaleOrThrow(rawLocale);

  const t = await getTranslations({ locale, namespace: "Holy" });

  const path = `/${locale}/quran/${surah}`;

  const alternates = createLocalizedAlternates(path, {
    types: {
      "text/markdown": `${path}.md`,
    },
  });
  const surahNumber = parseQuranSurahNumber(surah);

  if (surahNumber === null) {
    notFound();
  }

  const surahData = await getSurahMetadataData(surahNumber);
  if (!surahData) {
    notFound();
  }

  // Evidence: Use ICU-based SEO generator for type-safe, locale-aware metadata
  // Source: https://developers.google.com/search/docs/appearance/title-link
  // Evidence: Arabic name and source transliteration are universal.
  const seoContext: SEOContext = {
    type: "quran",
    surah: surahData,
  };

  const { title, description, keywords } = await getCachedSEOMetadata(
    seoContext,
    locale
  );
  const socialMetadata = getSocialMetadata({
    title,
    description,
    locale,
    path,
    image: getAppSocialArtwork({ key: "quran", locale, publicPath: "quran" }),
    type: "book",
  });

  return {
    title: { absolute: title },
    alternates,
    category: t("quran"),
    description,
    keywords,
    ...socialMetadata,
  };
}

/** Supplies one real surah per locale for Cache Components. */
export async function generateStaticParams() {
  const { surahs } = await getPublishedQuranCatalog();
  return [{ surah: surahs[0].number.toString() }];
}

/** Keeps the public page export synchronous while the resolved shell owns async route validation. */
export default function Page(props: PageProps<"/[locale]/quran/[surah]">) {
  return (
    <LayoutMaterial>
      <Suspense fallback={null}>
        <ResolvedSurahPage params={props.params} />
      </Suspense>
    </LayoutMaterial>
  );
}

/** Resolves a localized surah route before entering the cached Quran shell. */
async function ResolvedSurahPage({
  params,
}: {
  params: PageProps<"/[locale]/quran/[surah]">["params"];
}) {
  const { locale: rawLocale, surah } = await params;
  const locale = getLocaleOrThrow(rawLocale);
  const surahNumber = parseQuranSurahNumber(surah);

  if (surahNumber === null) {
    notFound();
  }

  return (
    <CachedSurahShell
      locale={locale}
      surah={surah}
      surahNumber={surahNumber}
      toolbar={<SheetEntry key={`assistant:${surah}`} />}
    />
  );
}

/** Reads lightweight cached surah metadata for route metadata. */
async function getSurahMetadataData(surahNumber: number) {
  "use cache";

  const catalog = await getPublishedQuranCatalog();
  return Option.getOrNull(
    Arr.findFirst(catalog.surahs, ({ number }) => number === surahNumber)
  );
}

/** Renders the cached Quran surah body, controls, pagination, and table of contents. */
async function CachedSurahShell({
  locale,
  surah,
  surahNumber,
  toolbar,
}: {
  locale: Locale;
  surah: string;
  surahNumber: number;
  toolbar: ReactNode;
}) {
  "use cache";

  const [t, tCommon, tToast, result] = await Promise.all([
    getTranslations({ locale, namespace: "Holy" }),
    getTranslations({ locale, namespace: "Common" }),
    getTranslations({ locale, namespace: "Toast" }),
    getPublishedQuranView(locale, surahNumber),
  ]);

  const surahData = result.surah;
  const servedSnapshotId = result.snapshotId;
  async function recoverSnapshot() {
    "use server";

    await Effect.runPromise(
      recoverStalePublishedQuranSnapshot(servedSnapshotId)
    );
  }
  const meaning = selectQuranMeaning(surahData.name.meaning, locale);
  const description = meaning.text;
  const descriptionLanguage = meaning.appLocale;
  const title = getQuranSurahName(surahData.name);

  const verseItems = Arr.map(result.verses, (verse) => {
    const label = t("verse-count", { count: verse.number.inSurah });

    return {
      id: toAnchorSlug(label),
      label,
      verse,
    };
  });
  // Every verse is in the page, so each outline entry links to it by fragment.
  const headings = Arr.map(verseItems, ({ id, label }) => ({
    label,
    href: `#${id}`,
    children: [],
  }));

  const pagination = getQuranPagination({
    nextSurah: result.nextSurah,
    prevSurah: result.previousSurah,
  });

  const interpretationLabel = t("interpretation");
  const tafsirAccess = result.tafsirAccess;
  const translationNotesLabel = t("translation-notes");
  const references = getQuranReferences(result.sources, tafsirAccess);

  return (
    <>
      <BreadcrumbJsonLd
        breadcrumbItems={createBreadcrumbItems(locale, [
          { name: tCommon("home"), path: "" },
          { name: t("quran"), path: "/quran" },
          { name: title, path: `/quran/${surah}` },
        ])}
      />
      <BookJsonLd
        author={{ "@type": "Person", name: "Allah" }}
        description={description}
        inLanguage={locale}
        name={title}
        position={surahNumber}
        totalPages={surahData.numberOfVerses}
        url={`${COMPANY_IDENTITY.url}/${locale}/quran/${surah}`}
      />
      <SidebarRightProvider>
        <LayoutMaterialContent>
          <QuranSurahHeader
            arabic={surahData.name.arabic}
            copySourceUrl={getLlmsMarkdownPath({
              locale,
              publicPath: `quran/${surah}`,
            })}
            meaning={description}
            meaningLanguage={descriptionLanguage}
            quranLabel={t("quran")}
            slug={`/${locale}/quran/${surah}`}
            title={title}
          />
          <LayoutContent className="pt-6">
            <QuranVersesProvider
              interpretationLabel={interpretationLabel}
              tafsirAccess={tafsirAccess}
              translationNotesLabel={translationNotesLabel}
            >
              {result.preBismillah === null ? null : (
                <QuranBismillah
                  bismillah={result.preBismillah}
                  subjectLabel={title}
                />
              )}
              {tafsirAccess.kind === "embedded" ? (
                <QuranInterpretationControls
                  appLocale={tafsirAccess.appLocale}
                  errorMessage={{
                    description: tToast("interpretation-error.description"),
                    title: tToast("interpretation-error.title"),
                  }}
                  label={interpretationLabel}
                  recoverSnapshot={recoverSnapshot}
                  refreshingMessage={{
                    description: tToast(
                      "interpretation-refreshing.description"
                    ),
                    title: tToast("interpretation-refreshing.title"),
                  }}
                  snapshotId={result.snapshotId}
                  surahNumber={surahData.number}
                >
                  <QuranVerseList items={verseItems} />
                </QuranInterpretationControls>
              ) : (
                <QuranVerseList items={verseItems} />
              )}
            </QuranVersesProvider>
          </LayoutContent>
          <PaginationContent pagination={pagination} />
          {toolbar}
        </LayoutMaterialContent>
        <SidebarRightPanel
          footer={
            <SidebarRightFooter>
              <ReferenceButton references={references} title={title} />
              <ReportButton />
              <ShareButton />
            </SidebarRightFooter>
          }
          header={
            <SidebarRightHeader
              description={description}
              descriptionLanguage={descriptionLanguage}
              href={`/quran/${surah}`}
              title={title}
            />
          }
        >
          <SidebarTree data={headings} title={t("verse")} />
        </SidebarRightPanel>
      </SidebarRightProvider>
    </>
  );
}
