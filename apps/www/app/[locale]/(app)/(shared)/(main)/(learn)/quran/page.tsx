import { AllahIcon } from "@hugeicons/core-free-icons";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import { BreadcrumbJsonLd } from "@repo/seo/json-ld/breadcrumb";
import type { Metadata } from "next";
import { type Locale, useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { FooterContent } from "@/components/shared/footer-content";
import { HeaderContent } from "@/components/shared/header-content";
import { LayoutContent } from "@/components/shared/layout-content";
import { RefContent } from "@/components/shared/ref-content";
import { fetchRuntimeQuranSurahs } from "@/lib/content/runtime/pages";
import { getLocaleOrThrow } from "@/lib/i18n/params";
import { getSocialMetadata } from "@/lib/utils/metadata";
import { getQuranSurahName, type QuranSurah } from "@/lib/utils/pages/quran";
import { createLocalizedAlternates } from "@/lib/utils/seo/alternates";
import { createBreadcrumbItems } from "@/lib/utils/seo/breadcrumbs";

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
    image: "/quran.png",
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
export default async function Page(props: PageProps<"/[locale]/quran">) {
  const { locale: rawLocale } = await props.params;
  const locale = getLocaleOrThrow(rawLocale);
  const surahs = await fetchRuntimeQuranSurahs();

  return <PageContent locale={locale} surahs={surahs} />;
}

/** Renders the Quran index list and shared SEO breadcrumbs for one locale. */
function PageContent({
  locale,
  surahs,
}: {
  locale: Locale;
  surahs: Omit<QuranSurah, "verses">[];
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
        <div className="overflow-hidden rounded-xl border shadow-sm">
          {surahs.map((surah) => {
            const title = getQuranSurahName({ locale, name: surah.name });
            return (
              <NavigationLink
                className="group flex w-full scroll-mt-28 items-center gap-2 border-t px-6 py-4 transition-colors ease-out first:border-t-0 first:pt-5 last:pb-5 hover:bg-accent hover:text-accent-foreground"
                href={`/quran/${surah.number}`}
                key={surah.number}
                title={title}
              >
                <div className="flex w-full items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex size-8 items-center justify-center rounded-full border border-primary bg-secondary text-secondary-foreground">
                      <span className="font-mono text-xs tracking-tighter">
                        {surah.number}
                      </span>
                    </div>
                    <h2>{title}</h2>
                  </div>

                  <p className="font-quran text-xl" dir="rtl">
                    {surah.name.short}
                  </p>
                </div>
              </NavigationLink>
            );
          })}
        </div>
      </LayoutContent>
      <FooterContent>
        <RefContent />
      </FooterContent>
    </>
  );
}
