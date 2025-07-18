import { getAllSurah } from "@repo/contents/_lib/quran";
import { Link } from "@repo/internationalization/src/navigation";
import { MoonStarIcon } from "lucide-react";
import type { Locale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { FooterContent } from "@/components/shared/footer-content";
import { HeaderContent } from "@/components/shared/header-content";
import { LayoutContent } from "@/components/shared/layout-content";
import { RefContent } from "@/components/shared/ref-content";

type Params = {
  locale: Locale;
};

type Props = {
  params: Promise<Params>;
};

export default async function Page({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations("Holy");

  const surahs = getAllSurah();

  return (
    <>
      <HeaderContent
        description={t("quran-description")}
        icon={MoonStarIcon}
        title={t("quran")}
      />
      <LayoutContent className="py-10">
        <div className="overflow-hidden rounded-xl border shadow-sm">
          {surahs.map((surah) => {
            const title =
              surah.name.transliteration[locale] ??
              surah.name.translation[locale] ??
              surah.name.long;
            return (
              <Link
                className="group flex w-full scroll-mt-28 items-center gap-2 border-t px-6 py-4 transition-colors first:border-t-0 first:pt-5 last:pb-5 hover:bg-accent hover:text-accent-foreground"
                href={`/quran/${surah.number}`}
                key={surah.number}
                prefetch
                title={title}
              >
                <div className="flex w-full items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex size-8 items-center justify-center rounded-full border border-primary bg-secondary text-secondary-foreground ring-1 ring-primary ring-offset-2 ring-offset-secondary/60">
                      <span className="font-mono text-xs tracking-tighter">
                        {surah.number}
                      </span>
                    </div>
                    <h2>{title}</h2>
                  </div>

                  <p className="font-arabic text-xl tracking-widest" dir="rtl">
                    {surah.name.short}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </LayoutContent>
      <FooterContent className="mt-0">
        <RefContent />
      </FooterContent>
    </>
  );
}
