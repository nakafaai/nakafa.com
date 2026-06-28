import { getCategoryIcon } from "@repo/contents/_lib/assessment/icons";
import { getMaterialIcon } from "@repo/contents/_lib/curriculum/material";
import { BreadcrumbJsonLd } from "@repo/seo/json-ld/breadcrumb";
import { CollectionPageJsonLd } from "@repo/seo/json-ld/collection-page";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import {
  getPracticeProgramData,
  listPracticeProgramStaticParams,
} from "@/app/[locale]/(app)/(shared)/(main)/(learn)/practice/[assessment]/data";
import { FooterContent } from "@/components/shared/footer-content";
import { HeaderContent } from "@/components/shared/header-content";
import { LayoutContent } from "@/components/shared/layout-content";
import { LayoutMaterialContent } from "@/components/shared/material/content";
import { LayoutMaterial } from "@/components/shared/material/layout";
import { RefContent } from "@/components/shared/ref-content";
import { SubjectItem } from "@/components/shared/subject-item";
import { SubjectList } from "@/components/shared/subject-list";
import { getGithubUrl } from "@/lib/utils/github";
import { getOgUrl, getSocialMetadata } from "@/lib/utils/metadata";
import { createLocalizedAlternates } from "@/lib/utils/seo/alternates";
import { createBreadcrumbItems } from "@/lib/utils/seo/breadcrumbs";
import { generateSEOMetadata } from "@/lib/utils/seo/generator";

interface PracticeProgramPageProps {
  params: Promise<{ assessment: string; locale: string }>;
}

/** Builds static params for canonical practice program roots. */
export function generateStaticParams({
  params,
}: {
  params: { locale: string };
}) {
  return listPracticeProgramStaticParams(params.locale);
}

/** Generates metadata for one canonical practice program root. */
export async function generateMetadata({
  params,
}: PracticeProgramPageProps): Promise<Metadata> {
  const data = await getPracticeProgramData(params);
  const seo = await generateSEOMetadata(data.seoContext, data.locale);
  const title = seo.title;
  const description = seo.description;
  const path = data.assessmentPath;

  return {
    title: { absolute: title },
    description,
    alternates: createLocalizedAlternates(path, {
      languages: Object.fromEntries(
        data.alternatePaths.map((alternate) => [
          alternate.locale,
          `/${alternate.locale}/${alternate.publicPath}`,
        ])
      ),
    }),
    ...getSocialMetadata({
      title,
      description,
      locale: data.locale,
      path,
      image: getOgUrl(data.locale, data.publicPath),
    }),
  };
}

/** Renders the canonical practice program root with domain chooser rows. */
export default async function Page({ params }: PracticeProgramPageProps) {
  const data = await getPracticeProgramData(params);
  const [t, tCommon] = await Promise.all([
    getTranslations({ locale: data.locale, namespace: "Exercises" }),
    getTranslations({ locale: data.locale, namespace: "Common" }),
  ]);
  const title = t(data.sourceType);
  const description = t("type-description");

  return (
    <>
      <BreadcrumbJsonLd
        breadcrumbItems={createBreadcrumbItems(data.locale, [
          { name: tCommon("home"), path: "" },
          { name: title, path: data.assessmentPath },
        ])}
      />
      <CollectionPageJsonLd
        description={description}
        items={data.domains.map((domain) => ({
          name: t(domain.sourceMaterial),
          url: `https://nakafa.com${domain.href}`,
        }))}
        name={title}
        url={`https://nakafa.com${data.assessmentPath}`}
      />
      <LayoutMaterial>
        <LayoutMaterialContent>
          <HeaderContent
            description={description}
            icon={getCategoryIcon(data.sourceCategory)}
            title={title}
          />
          <p className="sr-only">{t("program-domain-list-description")}</p>
          <LayoutContent>
            <SubjectList>
              {data.domains.map((domain) => (
                <SubjectItem
                  href={domain.href}
                  icon={getMaterialIcon(domain.sourceMaterial)}
                  key={domain.href}
                  label={t(domain.sourceMaterial)}
                />
              ))}
            </SubjectList>
          </LayoutContent>
          <FooterContent>
            <RefContent
              githubUrl={getGithubUrl({
                path: `/packages/contents/material/practice/assessment/${data.sourceType}`,
              })}
            />
          </FooterContent>
        </LayoutMaterialContent>
      </LayoutMaterial>
    </>
  );
}
