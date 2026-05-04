import { AllahIcon } from "@hugeicons/core-free-icons";
import { getAllSurah, getSurahName } from "@repo/contents/_lib/quran";
import { cn, slugify } from "@repo/design-system/lib/utils";
import { BookJsonLd } from "@repo/seo/json-ld/book";
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
import { QuranAudio } from "@/components/shared/quran-audio";
import { QuranInterpretation } from "@/components/shared/quran-interpretation";
import { QuranText } from "@/components/shared/quran-text";
import { RefContent } from "@/components/shared/ref-content";
import { WindowVirtualized } from "@/components/shared/window-virtualized";
import { VirtualProvider } from "@/lib/context/use-virtual";
import { getLocaleOrThrow } from "@/lib/i18n/params";
import {
  fetchSurahContext,
  fetchSurahMetadataContext,
  getQuranPagination,
} from "@/lib/utils/pages/quran";
import { generateSEOMetadata } from "@/lib/utils/seo/generator";
import type { SEOContext } from "@/lib/utils/seo/types";

export async function generateMetadata({
  params,
}: {
  params: PageProps<"/[locale]/quran/[surah]">["params"];
}): Promise<Metadata> {
  const { locale: rawLocale, surah } = await params;
  const locale = getLocaleOrThrow(rawLocale);

  const t = await getTranslations("Holy");

  const path = `/${locale}/quran/${surah}`;

  const alternates = {
    canonical: path,
    types: {
      "text/markdown": `${path}.md`,
    },
  };
  const image = {
    url: "/quran.png",
    width: 1200,
    height: 630,
  };
  const twitter: Metadata["twitter"] = {
    images: [image],
  };
  const openGraph: Metadata["openGraph"] = {
    url: path,
    images: [image],
    type: "book",
    siteName: "Nakafa",
    locale,
  };

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

  return {
    title: { absolute: title },
    alternates,
    category: t("quran"),
    description,
    keywords,
    twitter,
    openGraph,
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

  return (
    <CachedSurahShell
      footer={<RefContent key={`refs:${surah}`} />}
      locale={locale}
      surah={surah}
      toolbar={<DeferredAiSheetOpen key={`audio:${surah}`} />}
    />
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
  footer,
  toolbar,
}: {
  locale: Locale;
  surah: string;
  footer: ReactNode;
  toolbar: ReactNode;
}) {
  "use cache";

  cacheLife("max");

  const t = await getTranslations("Holy");

  const surahNumber = Number(surah);

  if (Number.isNaN(surahNumber)) {
    notFound();
  }

  const result = await Effect.runPromise(
    Effect.match(fetchSurahContext({ surah: surahNumber }), {
      onFailure: () => ({
        surahData: null,
        prevSurah: null,
        nextSurah: null,
      }),
      onSuccess: (data) => data,
    })
  );

  const { surahData, prevSurah, nextSurah } = result;

  if (!surahData) {
    notFound();
  }

  const translation = surahData.name.translation[locale];

  const preBismillah = surahData.preBismillah;

  const title = getSurahName({ locale, name: surahData.name });

  const headings = surahData.verses.map((verse, index) => ({
    label: t("verse-count", { count: verse.number.inSurah }),
    index,
    href: `/quran/${surah}#${slugify(t("verse-count", { count: verse.number.inSurah }))}`,
    children: [],
  }));

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

  return (
    <>
      <BookJsonLd
        author={{ "@type": "Person", name: "Allah" }}
        description={translation}
        inLanguage={locale}
        name={title}
        position={surahNumber}
        totalPages={surahData.verses.length}
        url={`https://nakafa.com/${locale}/quran/${surah}`}
      />
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
                  const transliteration = verse.text.transliteration.en;
                  const translate =
                    verse.translation[locale] ?? verse.translation.en;

                  const id = slugify(
                    t("verse-count", { count: verse.number.inSurah })
                  );

                  return (
                    <div
                      className={cn(
                        "mb-6 space-y-6 border-b pb-6",
                        index === surahData.verses.length - 1 &&
                          "mb-0 border-b-0 pb-0"
                      )}
                      key={verse.number.inQuran}
                    >
                      <div className="flex items-center gap-4">
                        <a
                          className="flex w-full flex-1 shrink-0 scroll-mt-44 outline-none ring-0"
                          href={`#${id}`}
                          id={id}
                        >
                          <div className="flex size-9 items-center justify-center rounded-full border border-primary bg-secondary text-secondary-foreground">
                            <span className="font-mono text-xs tracking-tighter">
                              {verse.number.inSurah}
                            </span>
                            <h2 className="sr-only">
                              {t("verse-count", {
                                count: verse.number.inSurah,
                              })}
                            </h2>
                          </div>
                        </a>

                        <div className="flex items-center gap-2">
                          <QuranAudio audio={verse.audio} />
                          {locale === "id" && (
                            <QuranInterpretation
                              interpretation={verse.tafsir.id.short}
                            />
                          )}
                        </div>
                      </div>
                      <QuranText>{verse.text.arab}</QuranText>
                      <div className="flex flex-col gap-2">
                        <p className="text-pretty text-muted-foreground text-sm italic leading-relaxed">
                          {transliteration}
                        </p>
                        <p className="text-pretty leading-relaxed">
                          {translate}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </WindowVirtualized>
            </LayoutMaterialMain>
            <LayoutMaterialPagination
              pagination={paginationWithLocalizedTitles}
            />
            <LayoutMaterialFooter>{footer}</LayoutMaterialFooter>
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
    </>
  );
}
