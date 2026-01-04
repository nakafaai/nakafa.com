import { AllahIcon } from "@hugeicons/core-free-icons";
import { getSurah, getSurahName } from "@repo/contents/_lib/quran";
import { cn, slugify } from "@repo/design-system/lib/utils";
import { Effect, Option } from "effect";
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

  const surahData = Option.fromNullable(
    Effect.runSync(
      Effect.match(getSurah(Number(surah)), {
        onFailure: () => null,
        onSuccess: (data) => data,
      })
    )
  );

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

  if (Option.isNone(surahData)) {
    return {
      alternates,
    };
  }

  const surahValue = Option.getOrThrow(surahData);
  const title = getSurahName({ locale, name: surahValue.name });

  const description = surahValue.name.translation[locale];

  return {
    title: {
      absolute: `${title} - ${t("quran")}`,
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

  if (Number.isNaN(Number(surah))) {
    notFound();
  }

  const surahData = Option.fromNullable(
    Effect.runSync(
      Effect.match(getSurah(Number(surah)), {
        onFailure: () => null,
        onSuccess: (data) => data,
      })
    )
  );

  const prevSurah = Option.fromNullable(
    Effect.runSync(
      Effect.match(getSurah(Number(surah) - 1), {
        onFailure: () => null,
        onSuccess: (data) => data,
      })
    )
  );

  const nextSurah = Option.fromNullable(
    Effect.runSync(
      Effect.match(getSurah(Number(surah) + 1), {
        onFailure: () => null,
        onSuccess: (data) => data,
      })
    )
  );

  if (Option.isNone(surahData)) {
    notFound();
  }

  const surahValue = Option.getOrThrow(surahData);

  const translation = surahValue.name.translation[locale];

  const preBismillah = surahValue.preBismillah;

  const title = getSurahName({ locale, name: surahValue.name });

  const headings = surahValue.verses.map((verse, index) => ({
    label: t("verse-count", { count: verse.number.inSurah }),
    index,
    href: `/quran/${surah}#${slugify(t("verse-count", { count: verse.number.inSurah }))}`,
    children: [],
  }));

  const pagination = {
    prev: {
      href: Option.isSome(prevSurah)
        ? `/quran/${Option.getOrThrow(prevSurah).number}`
        : "",
      title: Option.isSome(prevSurah)
        ? getSurahName({ locale, name: Option.getOrThrow(prevSurah).name })
        : "",
    },
    next: {
      href: Option.isSome(nextSurah)
        ? `/quran/${Option.getOrThrow(nextSurah).number}`
        : "",
      title: Option.isSome(nextSurah)
        ? getSurahName({ locale, name: Option.getOrThrow(nextSurah).name })
        : "",
    },
  };

  return (
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

          <WindowVirtualized ssrCount={surahValue.verses.length}>
            {surahValue.verses.map((verse, index) => {
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
                    index === surahValue.verses.length - 1 &&
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
        <LayoutMaterialPagination pagination={pagination} />
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
  );
}
