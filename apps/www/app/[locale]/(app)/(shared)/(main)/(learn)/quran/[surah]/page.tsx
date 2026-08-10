import { AllahIcon } from "@hugeicons/core-free-icons";
import { parseQuranSurahNumber } from "@repo/backend/client/quran/route";
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
import { QuranInterpretationControls } from "@/components/shared/quran-interpretation-controls";
import { QuranVerse } from "@/components/shared/quran-verse";
import { RefContent } from "@/components/shared/ref-content";
import { WindowVirtualized } from "@/components/shared/window-virtualized";
import {
  getPublishedQuranCatalog,
  getPublishedQuranView,
} from "@/lib/content/quran/publication";
import { recoverStalePublishedQuranSnapshot } from "@/lib/content/quran/recovery";
import { VirtualProvider } from "@/lib/context/use-virtual";
import { getLocaleOrThrow } from "@/lib/i18n/params";
import { getSocialMetadata } from "@/lib/utils/metadata";
import { getQuranPagination, getQuranSurahName } from "@/lib/utils/pages/quran";
import { createLocalizedAlternates } from "@/lib/utils/seo/alternates";
import { createBreadcrumbItems } from "@/lib/utils/seo/breadcrumbs";
import { generateSEOMetadata } from "@/lib/utils/seo/generator";
import type { SEOContext } from "@/lib/utils/seo/types";

const QURAN_INITIAL_VERSE_SSR_COUNT = 80;

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

  const { title, description, keywords } = await generateSEOMetadata(
    seoContext,
    locale
  );
  const socialMetadata = getSocialMetadata({
    title,
    description,
    locale,
    path,
    image: "/quran.png",
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
      footer={<RefContent key={`refs:${surah}`} />}
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
  footer,
  toolbar,
}: {
  locale: Locale;
  surah: string;
  surahNumber: number;
  footer: ReactNode;
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
  const translation = surahData.name.translation;
  const title = getQuranSurahName(surahData.name);

  const headings = result.verses.map((verse, index) => {
    const label = t("verse-count", { count: verse.number.inSurah });

    return {
      label,
      index,
      href: `/quran/${surah}#${slugify(label)}`,
      children: [],
    };
  });

  const pagination = getQuranPagination({
    nextSurah: result.nextSurah,
    prevSurah: result.previousSurah,
  });

  const interpretationLabel = t("interpretation");
  const hasInterpretation = result.locale === "id";
  const verseList = (
    <WindowVirtualized
      ssrCount={Math.min(result.verses.length, QURAN_INITIAL_VERSE_SSR_COUNT)}
    >
      {result.verses.map((verse, index) => {
        const verseLabel = t("verse-count", {
          count: verse.number.inSurah,
        });

        return (
          <QuranVerse
            hasInterpretation={hasInterpretation}
            id={slugify(verseLabel)}
            interpretationLabel={interpretationLabel}
            isLast={index === result.verses.length - 1}
            key={verse.number.inQuran}
            verse={verse}
            verseLabel={verseLabel}
          />
        );
      })}
    </WindowVirtualized>
  );

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
        description={translation}
        inLanguage={locale}
        name={title}
        position={surahNumber}
        totalPages={surahData.numberOfVerses}
        url={`https://nakafa.com/${locale}/quran/${surah}`}
      />
      <VirtualProvider>
        <LayoutMaterialContent>
          <HeaderContent
            description={translation}
            icon={AllahIcon}
            link={{
              href: "/quran",
              label: t("quran"),
            }}
            title={title}
          />
          <LayoutContent>
            {hasInterpretation ? (
              <QuranInterpretationControls
                errorMessage={t("interpretation-error")}
                label={interpretationLabel}
                recoverSnapshot={recoverSnapshot}
                refreshingMessage={t("interpretation-refreshing")}
                snapshotId={result.snapshotId}
                surahNumber={surahData.number}
              >
                {verseList}
              </QuranInterpretationControls>
            ) : (
              verseList
            )}
          </LayoutContent>
          <PaginationContent pagination={pagination} />
          <FooterContent>{footer}</FooterContent>
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
            description: translation,
          }}
        />
      </VirtualProvider>
    </>
  );
}
