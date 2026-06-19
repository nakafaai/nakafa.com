import { slugify } from "@repo/design-system/lib/utils";
import { BreadcrumbJsonLd } from "@repo/seo/json-ld/breadcrumb";
import { CollectionPageJsonLd } from "@repo/seo/json-ld/collection-page";
import type { Locale } from "next-intl";
import { getTranslations } from "next-intl/server";
import type { PracticeRouteData } from "@/app/[locale]/(app)/(shared)/(main)/(learn)/practice/[assessment]/[domain]/[[...path]]/data";
import { CardMaterial } from "@/components/shared/card-material";
import { ContainerList } from "@/components/shared/container-list";
import { FooterContent } from "@/components/shared/footer-content";
import { HeaderContent } from "@/components/shared/header-content";
import { LayoutContent } from "@/components/shared/layout-content";
import { LayoutMaterialContent } from "@/components/shared/material/content";
import { LayoutMaterial } from "@/components/shared/material/layout";
import { LayoutMaterialToc } from "@/components/shared/material/toc";
import { RefContent } from "@/components/shared/ref-content";
import { getGithubUrl } from "@/lib/utils/github";
import { createBreadcrumbItems } from "@/lib/utils/seo/breadcrumbs";

type DomainPracticeData = Extract<PracticeRouteData, { kind: "domain" }>;

/** Renders a practice domain page with curriculum-style material cards. */
export async function PracticeDomainPage({
  data,
  locale,
}: {
  data: DomainPracticeData;
  locale: Locale;
}) {
  const [t, tCommon] = await Promise.all([
    getTranslations({ locale, namespace: "Exercises" }),
    getTranslations({ locale, namespace: "Common" }),
  ]);
  const title = t(data.sourceMaterial);

  return (
    <>
      <BreadcrumbJsonLd
        breadcrumbItems={createBreadcrumbItems(locale, [
          { name: tCommon("home"), path: "" },
          { name: t(data.sourceType), path: data.pagePath },
          { name: title, path: data.pagePath },
        ])}
      />
      <CollectionPageJsonLd
        description={title}
        items={data.groups.flatMap((group) =>
          group.material.items.map((item) => ({
            name: item.title,
            url: `https://nakafa.com${item.href}`,
          }))
        )}
        name={`${t(data.sourceType)} - ${title}`}
        url={`https://nakafa.com${data.pagePath}`}
      />
      <LayoutMaterial>
        <LayoutMaterialContent>
          <HeaderContent title={title} />
          <p className="sr-only">
            {locale === "id"
              ? "Pilih set latihan yang tersedia untuk membuka soal latihan pada domain ini."
              : "Choose an available practice set to open the questions for this domain."}
          </p>
          <LayoutContent>
            <ContainerList className="sm:grid-cols-1">
              {data.groups.map((group) => (
                <CardMaterial
                  key={group.material.title}
                  material={group.material}
                />
              ))}
            </ContainerList>
          </LayoutContent>
          <FooterContent>
            <RefContent
              githubUrl={getGithubUrl({
                path: `/packages/contents/material/practice/assessment/${data.sourceType}/${data.sourceMaterial}`,
              })}
            />
          </FooterContent>
        </LayoutMaterialContent>
        <LayoutMaterialToc
          chapters={{
            label: t("exercises"),
            data: data.groups.map((group) => ({
              label: group.material.title,
              href: `#${slugify(group.material.title)}`,
              children: [],
            })),
          }}
          header={{
            title,
            href: data.pagePath,
          }}
        />
      </LayoutMaterial>
    </>
  );
}
