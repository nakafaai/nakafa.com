import { AllahIcon } from "@hugeicons/core-free-icons";
import type { RuntimeQuranSurah } from "@repo/backend/client/nakafa/types";
import { slugify } from "@repo/design-system/lib/routing/slug";
import { BookJsonLd } from "@repo/seo/json-ld/book";
import { BreadcrumbJsonLd } from "@repo/seo/json-ld/breadcrumb";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { Locale } from "next-intl";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { DeferredAiSheetOpen } from "@/components/ai/deferred-sheet-open";
import { FooterContent } from "@/components/shared/footer-content";
import { HeaderContent } from "@/components/shared/header-content";
import { LayoutContent } from "@/components/shared/layout-content";
import { LayoutMaterialContent } from "@/components/shared/material/content";
import { LayoutMaterial } from "@/components/shared/material/layout";
import { LayoutMaterialToc } from "@/components/shared/material/toc";
import { PaginationContent } from "@/components/shared/pagination-content";
import { QuranPageControls } from "@/components/shared/quran-controls";
import { QuranText } from "@/components/shared/quran-text";
import { QuranVerse } from "@/components/shared/quran-verse";
import { RefContent } from "@/components/shared/ref-content";
import { WindowVirtualized } from "@/components/shared/window-virtualized";
import { applyContentRuntimeCache } from "@/lib/content/cache";
import {
  fetchRuntimeQuranSurahMetadata,
  fetchRuntimeQuranSurahPage,
  fetchRuntimeQuranSurahs,
} from "@/lib/content/runtime/pages";
import { VirtualProvider } from "@/lib/context/use-virtual";
import { getLocaleOrThrow } from "@/lib/i18n/params";
import { getSocialMetadata } from "@/lib/utils/metadata";
import { getQuranPagination, getQuranSurahName } from "@/lib/utils/pages/quran";
import { createLocalizedAlternates } from "@/lib/utils/seo/alternates";
import { createBreadcrumbItems } from "@/lib/utils/seo/breadcrumbs";
import { generateSEOMetadata } from "@/lib/utils/seo/generator";
import type { SEOContext } from "@/lib/utils/seo/types";

const QURAN_INITIAL_VERSE_SSR_COUNT = 80;

/** Returns complete localized tafsir controls only when every surah verse has data. */
function getSurahInterpretations(
  verses: RuntimeQuranSurah["verses"],
  locale: Locale
) {
  const interpretations: string[] = [];

  for (const verse of verses) {
    const tafsir = verse.tafsir[locale];

    if (!tafsir?.short.trim()) {
      return;
    }

    interpretations.push(tafsir.short);
  }

  return interpretations;
}

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
  const surahNumber = Number(surah);

  if (Number.isNaN(surahNumber)) {
    notFound();
  }

  const surahData = await getSurahMetadataData({ surah: surahNumber });
  if (!surahData) {
    notFound();
  }

  // Evidence: Use ICU-based SEO generator for type-safe, locale-aware metadata
  // Source: https://developers.google.com/search/docs/appearance/title-link
  // Evidence: Arabic name is universal, locale-specific for transliteration/translation
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

/** Prebuilds Quran surah routes from the Convex Quran runtime catalog. */
export async function generateStaticParams() {
  const surahs = await fetchRuntimeQuranSurahs();

  return surahs.map((surah) => ({
    surah: surah.number.toString(),
  }));
}

/** Keeps the public page export synchronous while the resolved shell owns async route validation. */
export default function Page(props: PageProps<"/[locale]/quran/[surah]">) {
  return <ResolvedSurahPage params={props.params} />;
}

/** Resolves a localized surah route before rendering Quran SEO and page chrome. */
async function ResolvedSurahPage({
  params,
}: {
  params: PageProps<"/[locale]/quran/[surah]">["params"];
}) {
  const { locale: rawLocale, surah } = await params;
  const locale = getLocaleOrThrow(rawLocale);
  const surahNumber = Number(surah);

  if (Number.isNaN(surahNumber)) {
    notFound();
  }

  const [t, tCommon, surahData] = await Promise.all([
    getTranslations({ locale, namespace: "Holy" }),
    getTranslations({ locale, namespace: "Common" }),
    getSurahMetadataData({ surah: surahNumber }),
  ]);

  if (!surahData) {
    notFound();
  }

  const translation = surahData.name.translation[locale];
  const title = getQuranSurahName({ locale, name: surahData.name });

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
      <CachedSurahShell
        footer={<RefContent key={`refs:${surah}`} />}
        locale={locale}
        surah={surah}
        surahNumber={surahNumber}
        toolbar={<DeferredAiSheetOpen key={`audio:${surah}`} />}
      />
    </>
  );
}

/** Reads lightweight cached surah metadata for route metadata and JSON-LD. */
async function getSurahMetadataData({ surah }: { surah: number }) {
  "use cache";

  applyContentRuntimeCache();

  return await fetchRuntimeQuranSurahMetadata({ surah });
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

  applyContentRuntimeCache();

  const [t, result] = await Promise.all([
    getTranslations({ locale, namespace: "Holy" }),
    fetchRuntimeQuranSurahPage({ surah: surahNumber }),
  ]);

  const surahData = result?.surahData ?? null;
  const prevSurah = result?.prevSurah ?? null;
  const nextSurah = result?.nextSurah ?? null;

  if (!surahData) {
    notFound();
  }

  const translation = surahData.name.translation[locale];

  const preBismillah = surahData.preBismillah;

  const title = getQuranSurahName({ locale, name: surahData.name });

  const headings = surahData.verses.map((verse, index) => {
    const label = t("verse-count", { count: verse.number.inSurah });

    return {
      label,
      index,
      href: `/quran/${surah}#${slugify(label)}`,
      children: [],
    };
  });

  const pagination = getQuranPagination({
    locale,
    prevSurah,
    nextSurah,
  });

  const controlLabels = {
    interpretation: t("interpretation"),
    playAudio: t("play-audio"),
    stopAudio: t("stop-audio"),
  };

  const audioSources = surahData.verses.map((verse) => [
    verse.audio.primary,
    ...verse.audio.secondary,
  ]);

  const interpretations = getSurahInterpretations(surahData.verses, locale);

  return (
    <VirtualProvider>
      <LayoutMaterial>
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
            {!!preBismillah && (
              <div className="mb-20 flex flex-col items-center gap-4 rounded-xl border bg-card p-6 text-center shadow-sm">
                <QuranText>{preBismillah.text.arab}</QuranText>
                <p className="text-pretty text-muted-foreground text-sm italic leading-relaxed">
                  {preBismillah.translation[locale]}
                </p>
              </div>
            )}

            <WindowVirtualized
              ssrCount={Math.min(
                surahData.verses.length,
                QURAN_INITIAL_VERSE_SSR_COUNT
              )}
            >
              {surahData.verses.map((verse, index) => {
                const verseLabel = t("verse-count", {
                  count: verse.number.inSurah,
                });

                return (
                  <QuranVerse
                    hasInterpretation={interpretations !== undefined}
                    id={slugify(verseLabel)}
                    index={index}
                    isLast={index === surahData.verses.length - 1}
                    key={verse.number.inQuran}
                    labels={controlLabels}
                    locale={locale}
                    verse={verse}
                    verseLabel={verseLabel}
                  />
                );
              })}
            </WindowVirtualized>
          </LayoutContent>
          <PaginationContent pagination={pagination} />
          <FooterContent>{footer}</FooterContent>
          <QuranPageControls
            audioSources={audioSources}
            interpretations={interpretations}
            labels={controlLabels}
          />
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
      </LayoutMaterial>
    </VirtualProvider>
  );
}
