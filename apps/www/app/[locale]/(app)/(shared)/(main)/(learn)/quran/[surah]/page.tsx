import { AllahIcon } from "@hugeicons/core-free-icons";
import { getAllSurah, getSurahName } from "@repo/contents/_lib/quran";
import { slugify } from "@repo/design-system/lib/utils";
import { BookJsonLd } from "@repo/seo/json-ld/book";
import { BreadcrumbJsonLd } from "@repo/seo/json-ld/breadcrumb";
import { Effect } from "effect";
import type { Metadata } from "next";
import { cacheLife } from "next/cache";
import { notFound } from "next/navigation";
import type { Locale } from "next-intl";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { DeferredAiSheetOpen } from "@/components/ai/deferred-sheet-open";
import {
  LayoutMaterial,
  LayoutMaterialContent,
  LayoutMaterialFooter,
  LayoutMaterialHeader,
  LayoutMaterialMain,
  LayoutMaterialPagination,
  LayoutMaterialToc,
} from "@/components/shared/layout-material";
import { QuranPageControls } from "@/components/shared/quran-controls";
import { QuranText } from "@/components/shared/quran-text";
import { QuranVerse } from "@/components/shared/quran-verse";
import { RefContent } from "@/components/shared/ref-content";
import { WindowVirtualized } from "@/components/shared/window-virtualized";
import { VirtualProvider } from "@/lib/context/use-virtual";
import { getLocaleOrThrow } from "@/lib/i18n/params";
import { getSocialMetadata } from "@/lib/utils/metadata";
import {
  fetchSurahContext,
  fetchSurahMetadataContext,
  getQuranPagination,
} from "@/lib/utils/pages/quran";
import { createLocalizedAlternates } from "@/lib/utils/seo/alternates";
import { createBreadcrumbItems } from "@/lib/utils/seo/breadcrumbs";
import { generateSEOMetadata } from "@/lib/utils/seo/generator";
import type { SEOContext } from "@/lib/utils/seo/types";

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

export function generateStaticParams() {
  return getAllSurah().map((surah) => ({
    surah: surah.number.toString(),
  }));
}

export default function Page(props: PageProps<"/[locale]/quran/[surah]">) {
  return <ResolvedSurahPage params={props.params} />;
}

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
  const title = getSurahName({ locale, name: surahData.name });

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
        totalPages={surahData.verses.length}
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

async function getSurahMetadataData({ surah }: { surah: number }) {
  "use cache";

  cacheLife("max");

  const surahMetadataContext = await Effect.runPromise(
    Effect.match(fetchSurahMetadataContext({ surah }), {
      onFailure: () => null,
      onSuccess: (data) => data,
    })
  );

  return surahMetadataContext?.surahData ?? null;
}

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

  cacheLife("max");

  const [t, result] = await Promise.all([
    getTranslations({ locale, namespace: "Holy" }),
    Effect.runPromise(
      Effect.match(fetchSurahContext({ surah: surahNumber }), {
        onFailure: () => ({
          surahData: null,
          prevSurah: null,
          nextSurah: null,
        }),
        onSuccess: (data) => data,
      })
    ),
  ]);

  const { surahData, prevSurah, nextSurah } = result;

  if (!surahData) {
    notFound();
  }

  const translation = surahData.name.translation[locale];

  const preBismillah = surahData.preBismillah;

  const title = getSurahName({ locale, name: surahData.name });

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
    prevSurah,
    nextSurah,
  });

  const prevTitle = prevSurah
    ? getSurahName({ locale, name: prevSurah.name })
    : "";
  const nextTitle = nextSurah
    ? getSurahName({ locale, name: nextSurah.name })
    : "";

  const paginationWithLocalizedTitles = {
    prev: {
      href: pagination.prev.href,
      title: prevTitle,
    },
    next: {
      href: pagination.next.href,
      title: nextTitle,
    },
  };

  const controlLabels = {
    interpretation: t("interpretation"),
    playAudio: t("play-audio"),
    stopAudio: t("stop-audio"),
  };

  const audioSources = surahData.verses.map((verse) => [
    verse.audio.primary,
    ...verse.audio.secondary,
  ]);

  const interpretations =
    locale === "id"
      ? surahData.verses.map((verse) => verse.tafsir.id.short)
      : undefined;

  return (
    <VirtualProvider>
      <LayoutMaterial>
        <LayoutMaterialContent>
          <LayoutMaterialHeader
            description={translation}
            icon={AllahIcon}
            link={{
              href: "/quran",
              label: t("quran"),
            }}
            title={title}
          />
          <LayoutMaterialMain>
            {!!preBismillah && (
              <div className="mb-20 flex flex-col items-center gap-4 rounded-xl border bg-card p-6 text-center shadow-sm">
                <QuranText>{preBismillah.text.arab}</QuranText>
                <p className="text-pretty text-muted-foreground text-sm italic leading-relaxed">
                  {preBismillah.translation[locale] ??
                    preBismillah.translation.en}
                </p>
              </div>
            )}

            <WindowVirtualized ssrCount={surahData.verses.length}>
              {surahData.verses.map((verse, index) => {
                const verseLabel = t("verse-count", {
                  count: verse.number.inSurah,
                });

                return (
                  <QuranVerse
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
          </LayoutMaterialMain>
          <LayoutMaterialPagination
            pagination={paginationWithLocalizedTitles}
          />
          <LayoutMaterialFooter>{footer}</LayoutMaterialFooter>
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
