import { AllahIcon } from "@hugeicons/core-free-icons";
import { getSurahName } from "@repo/contents/_lib/quran";
import { cn, slugify } from "@repo/design-system/lib/utils";
import { BookJsonLd } from "@repo/seo/json-ld/book";
import { Effect } from "effect";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { type Locale, useTranslations } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { use } from "react";
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
import {
  fetchSurahContext,
  fetchSurahMetadataContext,
  getQuranPagination,
} from "@/lib/utils/pages/quran";
import { createSEODescription } from "@/lib/utils/seo/descriptions";

export const revalidate = false;

interface Props {
  params: Promise<{
    locale: Locale;
    surah: string;
  }>;
}

export async function generateMetadata({
  params,
}: {
  params: Props["params"];
}): Promise<Metadata> {
  const { locale, surah } = await params;

  const t = await getTranslations({ locale, namespace: "Holy" });

  const path = `/${locale}/quran/${surah}`;

  const alternates = {
    canonical: path,
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
    return {
      alternates,
    };
  }

  const surahMetadataContext = await Effect.runPromise(
    Effect.match(fetchSurahMetadataContext({ surah: surahNumber }), {
      onFailure: () => null,
      onSuccess: (data) => data,
    })
  );

  const surahData = surahMetadataContext?.surahData ?? null;
  if (!surahData) {
    return {
      alternates,
    };
  }

  const surahName = getSurahName({ locale, name: surahData.name });
  const surahTranslation = surahData.name.translation[locale];

  // SEO-optimized title with rich translation key for i18n scalability
  const title = t("surah-title", {
    number: surahData.number,
    name: surahName,
    translation: surahTranslation,
    quran: t("quran"),
  });

  // Build SEO description from content parts
  const description = createSEODescription([
    `${surahTranslation} (${surahName}) - ${surahData.numberOfVerses} ${t("verses")}. ${t("read-quran-description")}`,
    `${t("quran")} ${surahData.number}`,
  ]);

  return {
    title: {
      absolute: title,
    },
    alternates,
    category: t("quran"),
    description,
    twitter,
    openGraph,
  };
}

export function generateStaticParams() {
  // surah 1-114
  return Array.from({ length: 114 }, (_, i) => ({
    surah: (i + 1).toString(),
  }));
}

export default function Page({ params }: Props) {
  const { locale, surah } = use(params);

  // Enable static rendering
  setRequestLocale(locale);

  return <PageContent locale={locale} surah={surah} />;
}

function PageContent({ locale, surah }: { locale: Locale; surah: string }) {
  const t = useTranslations("Holy");

  const surahNumber = Number(surah);

  if (Number.isNaN(surahNumber)) {
    notFound();
  }

  const result = use(
    Effect.runPromise(
      Effect.match(fetchSurahContext({ surah: surahNumber }), {
        onFailure: () => ({
          surahData: null,
          prevSurah: null,
          nextSurah: null,
        }),
        onSuccess: (data) => data,
      })
    )
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
      <LayoutMaterial>
        <LayoutMaterialContent showAskButton>
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
                            {t("verse-count", { count: verse.number.inSurah })}
                          </h2>
                        </div>
                      </a>

                      <div className="flex items-center gap-2">
                        <QuranAudio audio={verse.audio} />
                        {locale === "id" && (
                          // Only available in Indonesian
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
                      <p className="text-pretty leading-relaxed">{translate}</p>
                    </div>
                  </div>
                );
              })}
            </WindowVirtualized>
          </LayoutMaterialMain>
          <LayoutMaterialPagination
            pagination={paginationWithLocalizedTitles}
          />
          <LayoutMaterialFooter>
            <RefContent />
          </LayoutMaterialFooter>
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
    </>
  );
}
