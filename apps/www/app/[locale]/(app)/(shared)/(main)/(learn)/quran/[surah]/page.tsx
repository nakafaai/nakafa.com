import { AllahIcon } from "@hugeicons/core-free-icons";
import { parseQuranSurahNumber } from "@repo/backend/client/quran/route";
import { selectQuranMeaning } from "@repo/backend/content/quran/contract";
import { slugify } from "@repo/design-system/lib/routing/slug";
import { BookJsonLd } from "@repo/seo/json-ld/book";
import { BreadcrumbJsonLd } from "@repo/seo/json-ld/breadcrumb";
import { Effect } from "effect";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { Locale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { type ReactNode, Suspense } from "react";
import { DeferredAiSheetOpen } from "@/components/ai/deferred-sheet-open";
import { FooterContent } from "@/components/shared/footer-content";
import { HeaderContent } from "@/components/shared/header-content";
import { LayoutContent } from "@/components/shared/layout-content";
import { LayoutMaterialContent } from "@/components/shared/material/content";
import { LayoutMaterial } from "@/components/shared/material/layout";
import { LayoutMaterialToc } from "@/components/shared/material/toc";
import { PaginationContent } from "@/components/shared/pagination-content";
import { QuranBismillah } from "@/components/shared/quran/bismillah";
import {
  QuranInterpretationButton,
  QuranInterpretationLink,
} from "@/components/shared/quran/interpretation/button";
import { QuranInterpretationControls } from "@/components/shared/quran/interpretation/controls";
import { QuranVerseList } from "@/components/shared/quran/verses/list";
import { RefContent } from "@/components/shared/ref-content";
import {
  getPublishedQuranCatalog,
  getPublishedQuranView,
} from "@/lib/content/quran/publication";
import { recoverStalePublishedQuranSnapshot } from "@/lib/content/quran/recovery";
import { getQuranReferences } from "@/lib/content/quran/references";
import { VirtualProvider } from "@/lib/context/use-virtual";
import { getLocaleOrThrow } from "@/lib/i18n/params";
import { getAppSocialArtwork } from "@/lib/og/app-artwork";
import { createLocalizedAlternates } from "@/lib/seo/alternates";
import { createBreadcrumbItems } from "@/lib/seo/breadcrumbs";
import { getCachedSEOMetadata } from "@/lib/seo/cache";
import type { SEOContext } from "@/lib/seo/contract";
import { getSocialMetadata } from "@/lib/utils/metadata";
import { getQuranPagination, getQuranSurahName } from "@/lib/utils/pages/quran";

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

/** Prebuilds Quran surah routes from the active signed Quran catalog. */
export async function generateStaticParams() {
  const { surahs } = await getPublishedQuranCatalog();

  return surahs.map((surah) => ({
    surah: surah.number.toString(),
  }));
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
      toolbar={<DeferredAiSheetOpen key={`assistant:${surah}`} />}
    />
  );
}

/** Reads lightweight cached surah metadata for route metadata. */
async function getSurahMetadataData(surahNumber: number) {
  "use cache";

  const catalog = await getPublishedQuranCatalog();
  return catalog.surahs.find(({ number }) => number === surahNumber) ?? null;
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

  const [t, tCommon, result] = await Promise.all([
    getTranslations({ locale, namespace: "Holy" }),
    getTranslations({ locale, namespace: "Common" }),
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

  const verseItems = result.verses.map((verse) => {
    const label = t("verse-count", { count: verse.number.inSurah });

    return {
      id: slugify(label),
      label,
      verse,
    };
  });
  const headings = verseItems.map(({ id, label }, index) => ({
    label,
    index,
    href: `/quran/${surah}#${id}`,
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
        url={`https://nakafa.com/${locale}/quran/${surah}`}
      />
      <VirtualProvider>
        <LayoutMaterialContent>
          <HeaderContent
            description={description}
            descriptionLanguage={descriptionLanguage}
            icon={AllahIcon}
            link={{
              href: "/quran",
              label: t("quran"),
            }}
            title={title}
          />
          <LayoutContent>
            {result.preBismillah === null ? null : (
              <QuranBismillah
                bismillah={result.preBismillah}
                subjectLabel={title}
                translationNotesLabel={translationNotesLabel}
              />
            )}
            {tafsirAccess.kind === "embedded" ? (
              <QuranInterpretationControls
                appLocale={tafsirAccess.appLocale}
                errorMessage={t("interpretation-error")}
                label={interpretationLabel}
                recoverSnapshot={recoverSnapshot}
                refreshingMessage={t("interpretation-refreshing")}
                snapshotId={result.snapshotId}
                surahNumber={surahData.number}
              >
                <QuranVerseList
                  items={verseItems}
                  renderAction={(verse, verseLabel) => (
                    <QuranInterpretationButton
                      label={`${interpretationLabel}: ${verseLabel}`}
                      verseNumber={verse.number.inSurah}
                    />
                  )}
                  translationNotesLabel={translationNotesLabel}
                />
              </QuranInterpretationControls>
            ) : (
              <QuranVerseList
                items={verseItems}
                renderAction={(_verse, verseLabel) => (
                  <QuranInterpretationLink
                    href={tafsirAccess.source.sourceUrl}
                    label={`${interpretationLabel}: ${verseLabel}`}
                  />
                )}
                translationNotesLabel={translationNotesLabel}
              />
            )}
          </LayoutContent>
          <PaginationContent pagination={pagination} />
          <FooterContent>
            <RefContent references={references} title={title} />
          </FooterContent>
          {toolbar}
        </LayoutMaterialContent>
        <LayoutMaterialToc
          chapters={{
            label: t("verse"),
            data: headings,
          }}
          header={{
            title,
            href: `/quran/${surah}`,
            description,
            descriptionLanguage,
          }}
        />
      </VirtualProvider>
    </>
  );
}
