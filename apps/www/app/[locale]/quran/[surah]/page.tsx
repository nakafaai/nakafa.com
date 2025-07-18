import { getSurah } from "@repo/contents/_lib/quran";
import { slugify } from "@repo/design-system/lib/utils";
import { MoonStarIcon } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { Locale } from "next-intl";
import { getTranslations } from "next-intl/server";
import {
  LayoutMaterial,
  LayoutMaterialContent,
  LayoutMaterialFooter,
  LayoutMaterialHeader,
  LayoutMaterialMain,
  LayoutMaterialPagination,
  LayoutMaterialToc,
} from "@/components/shared/layout-material";
import { RefContent } from "@/components/shared/ref-content";

type Props = {
  params: Promise<{
    locale: Locale;
    surah: string;
  }>;
};

export async function generateMetadata({
  params,
}: {
  params: Props["params"];
}): Promise<Metadata> {
  const { locale, surah } = await params;

  const t = await getTranslations("Holy");

  const path = `/${locale}/quran/${surah}`;

  const surahData = getSurah(Number(surah));

  const alternates = {
    canonical: path,
  };

  if (!surahData) {
    return {
      alternates,
    };
  }

  const title =
    surahData.name.transliteration[locale] ??
    surahData.name.translation[locale] ??
    surahData.name.long;

  const description = surahData.name.translation[locale];

  return {
    title: {
      absolute: `${title} - ${t("quran")}`,
    },
    alternates,
    category: t("quran"),
    description,
  };
}

export function generateStaticParams() {
  // surah 1-114
  return Array.from({ length: 114 }, (_, i) => ({
    surah: (i + 1).toString(),
  }));
}

export default async function Page({ params }: Props) {
  const { locale, surah } = await params;

  const t = await getTranslations("Holy");

  // check if surah is a number
  if (Number.isNaN(Number(surah))) {
    notFound();
  }

  const surahData = getSurah(Number(surah));

  const previousSurah = getSurah(Number(surah) - 1);
  const nextSurah = getSurah(Number(surah) + 1);

  if (!surahData) {
    notFound();
  }

  const translation = surahData.name.translation[locale];

  const title =
    surahData.name.transliteration[locale] ??
    translation ??
    surahData.name.long;

  const headings = surahData.verses.map((verse) => ({
    label: t("verse-count", { count: verse.number.inSurah }),
    href: `/quran/${surah}#${slugify(t("verse-count", { count: verse.number.inSurah }))}`,
  }));

  const pagination = {
    prev: {
      href: previousSurah ? `/quran/${previousSurah.number}` : "",
      title:
        previousSurah?.name.transliteration[locale] ??
        previousSurah?.name.translation[locale] ??
        previousSurah?.name.long ??
        "",
    },
    next: {
      href: nextSurah ? `/quran/${nextSurah.number}` : "",
      title:
        nextSurah?.name.transliteration[locale] ??
        nextSurah?.name.translation[locale] ??
        nextSurah?.name.long ??
        "",
    },
  };

  return (
    <LayoutMaterial>
      <LayoutMaterialContent>
        <LayoutMaterialHeader
          description={translation}
          icon={MoonStarIcon}
          link={{
            href: "/quran",
            label: t("quran"),
          }}
          title={title}
        />
        <LayoutMaterialMain>
          {surahData.verses.map((verse) => {
            const transliteration = verse.text.transliteration.en;
            const translate = verse.translation[locale] ?? verse.translation.en;

            const id = slugify(
              t("verse-count", { count: verse.number.inSurah })
            );

            return (
              <div
                className="mb-6 space-y-2 border-b pb-6 last:mb-0 last:border-b-0 last:pb-0"
                key={verse.number.inQuran}
              >
                <a className="flex w-full scroll-mt-44" href={`#${id}`} id={id}>
                  <div className="flex size-6 items-center justify-center rounded-full border border-primary bg-secondary text-secondary-foreground ring-1 ring-primary ring-offset-2 ring-offset-secondary/60">
                    <span className="font-mono text-xs tracking-tighter">
                      {verse.number.inSurah}
                    </span>
                    <h2 className="sr-only">
                      {t("verse-count", { count: verse.number.inSurah })}
                    </h2>
                  </div>
                </a>
                <p className="font-arabic text-4xl leading-relaxed" dir="rtl">
                  {verse.text.arab}
                </p>
                <div className="flex flex-col gap-1">
                  <p className="text-muted-foreground text-sm italic leading-relaxed">
                    {transliteration}
                  </p>
                  <p className="text-pretty text-foreground/80 leading-relaxed">
                    {translate}
                  </p>
                </div>
              </div>
            );
          })}
        </LayoutMaterialMain>
        <LayoutMaterialPagination pagination={pagination} />
        <LayoutMaterialFooter className="mt-10">
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
