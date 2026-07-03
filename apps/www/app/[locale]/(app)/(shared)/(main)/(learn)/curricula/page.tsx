import { routing } from "@repo/internationalization/src/routing";
import { BreadcrumbJsonLd } from "@repo/seo/json-ld/breadcrumb";
import { CollectionPageJsonLd } from "@repo/seo/json-ld/collection-page";
import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { readCurriculumRootRoutes } from "@/app/[locale]/(app)/(shared)/(main)/(learn)/curricula/[curriculum]/[[...path]]/data";
import {
  CurriculumIndexHeader,
  CurriculumRootCards,
} from "@/app/[locale]/(app)/(shared)/(main)/(learn)/curricula/[curriculum]/[[...path]]/root";
import { ComingSoon } from "@/components/shared/coming-soon";
import { FooterContent } from "@/components/shared/footer-content";
import { LayoutContent } from "@/components/shared/layout-content";
import { LayoutMaterialContent } from "@/components/shared/material/content";
import { LayoutMaterial } from "@/components/shared/material/layout";
import { RefContent } from "@/components/shared/ref-content";
import { getCurriculumIndexHref } from "@/lib/curriculum/routes";
import { getLocaleOrThrow } from "@/lib/i18n/params";
import { getGithubUrl } from "@/lib/utils/github";
import { getOgUrl, getSocialMetadata } from "@/lib/utils/metadata";
import { createLocalizedAlternates } from "@/lib/utils/seo/alternates";
import { createBreadcrumbItems } from "@/lib/utils/seo/breadcrumbs";

interface CurriculumIndexPageProps {
  params: Promise<{ locale: string }>;
}

/** Generates metadata for the public curriculum chooser page. */
export async function generateMetadata({
  params,
}: CurriculumIndexPageProps): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = getLocaleOrThrow(rawLocale);
  const t = await getTranslations({ locale, namespace: "LearningPrograms" });
  const title = t("curriculum-index-metadata-title");
  const description = t("curriculum-index-metadata-description");
  const href = getLocalizedCurriculumIndexPath(locale);

  return {
    title: { absolute: title },
    description,
    alternates: createLocalizedAlternates(href, {
      languages: buildCurriculumIndexAlternates(),
    }),
    ...getSocialMetadata({
      title,
      description,
      locale,
      path: href,
      image: getOgUrl(locale, getCurriculumIndexHref(locale)),
    }),
  };
}

/** Renders the public curriculum chooser with direct curriculum cards. */
export default async function Page({ params }: CurriculumIndexPageProps) {
  const { locale: rawLocale } = await params;
  const locale = getLocaleOrThrow(rawLocale);
  const [tCommon, tLearningPrograms] = await Promise.all([
    getTranslations({ locale, namespace: "Common" }),
    getTranslations({ locale, namespace: "LearningPrograms" }),
  ]);
  const title = tLearningPrograms("curriculum-index-title");
  const description = tLearningPrograms(
    "curriculum-index-metadata-description"
  );
  const routes = readCurriculumRootRoutes(locale);
  const path = getLocalizedCurriculumIndexPath(locale);

  return (
    <>
      <BreadcrumbJsonLd
        breadcrumbItems={createBreadcrumbItems(locale, [
          { name: tCommon("home"), path: "" },
          { name: title, path: getCurriculumIndexHref(locale) },
        ])}
      />
      <CollectionPageJsonLd
        description={description}
        items={routes.map((route) => ({
          name: route.title,
          url: `https://nakafa.com/${locale}/${route.publicPath}`,
        }))}
        name={title}
        url={`https://nakafa.com${path}`}
      />
      <LayoutMaterial>
        <LayoutMaterialContent>
          <CurriculumIndexHeader homeLabel={tCommon("home")} title={title} />
          <LayoutContent>
            {routes.length > 0 ? (
              <CurriculumRootCards locale={locale} routes={routes} />
            ) : (
              <ComingSoon />
            )}
          </LayoutContent>
          <FooterContent>
            <RefContent
              githubUrl={getGithubUrl({
                path: "/packages/contents/curriculum",
              })}
            />
          </FooterContent>
        </LayoutMaterialContent>
      </LayoutMaterial>
    </>
  );
}

/** Builds the localized curriculum index path including its locale prefix. */
function getLocalizedCurriculumIndexPath(locale: Locale) {
  return `/${locale}${getCurriculumIndexHref(locale)}`;
}

/** Builds language alternates for the static curriculum index route. */
function buildCurriculumIndexAlternates() {
  const languages: { [Key in (typeof routing.locales)[number]]?: string } = {};

  for (const locale of routing.locales) {
    languages[locale] = getLocalizedCurriculumIndexPath(locale);
  }

  return languages;
}
