import { AllahIcon } from "@hugeicons/core-free-icons";
import type { PublishedQuranSurah } from "@repo/backend/content/quran/contract";
import { Card } from "@repo/design-system/components/ui/card";
import { BreadcrumbJsonLd } from "@repo/seo/json-ld/breadcrumb";
import type { Metadata } from "next";
import { locale as rootLocale } from "next/root-params";
import { type Locale, useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { CardLink, CardLinks } from "@/components/shared/card/link";
import { HeaderContent } from "@/components/shared/content/header";
import { LayoutContent } from "@/components/shared/content/layout";
import { QuranSurahName } from "@/components/shared/quran/name";
import { getPublishedQuranCatalog } from "@/lib/content/quran/publication";
import { getLocaleOrThrow } from "@/lib/i18n/params";
import { getAppSocialArtwork } from "@/lib/og/app";
import { createLocalizedAlternates } from "@/lib/seo/alternates";
import { createBreadcrumbItems } from "@/lib/seo/breadcrumbs";
import { getSocialMetadata } from "@/lib/utils/metadata";
import { getQuranSurahName } from "@/lib/utils/pages/quran";

/** Builds localized Quran index metadata with markdown alternates for agent-readable docs. */
export async function generateMetadata({
  params,
}: {
  params: PageProps<"/[locale]/quran">["params"];
}): Promise<Metadata> {
  const locale = getLocaleOrThrow((await params).locale);

  const t = await getTranslations({ locale, namespace: "Holy" });

  const path = `/${locale}/quran`;

  const alternates = createLocalizedAlternates(path, {
    types: {
      "text/markdown": `${path}.md`,
    },
  });
  const title = t("quran");
  const description = t("quran-description");
  const socialMetadata = getSocialMetadata({
    title,
    description,
    locale,
    path,
    image: getAppSocialArtwork({ key: "quran", locale, publicPath: "quran" }),
    type: "book",
  });

  return {
    title,
    description,
    alternates,
    category: t("quran"),
    ...socialMetadata,
  };
}

/** Loads the Quran surah catalog before rendering the localized index. */
export default async function Page() {
  const locale = getLocaleOrThrow(await rootLocale());
  const { surahs } = await getPublishedQuranCatalog();

  return <PageContent locale={locale} surahs={surahs} />;
}

/** Renders the Quran index list and shared SEO breadcrumbs for one locale. */
function PageContent({
  locale,
  surahs,
}: {
  locale: Locale;
  surahs: Omit<PublishedQuranSurah, "verses">[];
}) {
  const t = useTranslations("Holy");
  const tCommon = useTranslations("Common");

  return (
    <>
      <BreadcrumbJsonLd
        breadcrumbItems={createBreadcrumbItems(locale, [
          { name: tCommon("home"), path: "" },
          { name: t("quran"), path: "/quran" },
        ])}
      />
      <HeaderContent
        description={t("quran-description")}
        icon={AllahIcon}
        title={t("quran")}
      />
      <LayoutContent>
        <Card className="pt-3 pb-0">
          <CardLinks>
            {surahs.map((surah) => {
              const title = getQuranSurahName(surah.name);
              return (
                <CardLink
                  href={`/quran/${surah.number}`}
                  key={surah.number}
                  title={title}
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-full border border-primary bg-secondary text-secondary-foreground">
                      <span className="font-mono text-xs tracking-tighter">
                        {surah.number}
                      </span>
                    </div>
                    <h2 className="flex min-w-0 items-baseline gap-2">
                      <QuranSurahName
                        arabic={surah.name.arabic}
                        title={title}
                      />
                    </h2>
                  </div>
                </CardLink>
              );
            })}
          </CardLinks>
        </Card>
      </LayoutContent>
    </>
  );
}
