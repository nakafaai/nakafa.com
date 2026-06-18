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

type GroupPracticeData = Extract<PracticeRouteData, { kind: "year-group" }>;

/** Renders the restored practice group overview under the canonical URL. */
export async function PracticeGroupPage({
  data,
  locale,
}: {
  data: GroupPracticeData;
  locale: Locale;
}) {
  const [t, tCommon] = await Promise.all([
    getTranslations({ locale, namespace: "Exercises" }),
    getTranslations({ locale, namespace: "Common" }),
  ]);
  const headingId = slugify(data.group.material.title);

  return (
    <>
      <BreadcrumbJsonLd
        breadcrumbItems={createBreadcrumbItems(locale, [
          { name: tCommon("home"), path: "" },
          { name: t(data.group.sourceType), path: data.group.pagePath },
          { name: t(data.group.sourceMaterial), path: data.group.materialPath },
          { name: data.group.material.title, path: data.pagePath },
        ])}
      />
      <CollectionPageJsonLd
        description={
          data.group.material.description ?? t(data.group.sourceType)
        }
        items={data.group.material.items.map((item) => ({
          name: item.title,
          url: `https://nakafa.com${item.href}`,
        }))}
        name={`${t(data.group.sourceMaterial)} - ${data.group.material.title}`}
        url={`https://nakafa.com${data.pagePath}`}
      />
      <LayoutMaterial>
        <LayoutMaterialContent>
          <HeaderContent
            link={{
              href: data.group.materialPath,
              label: t(data.group.sourceMaterial),
            }}
            title={data.group.material.title}
          />
          <p className="sr-only">
            {locale === "id"
              ? "Pilih set latihan yang tersedia untuk membuka soal latihan pada topik ini."
              : "Choose an available practice set to open the questions for this topic."}
          </p>
          <LayoutContent>
            <ContainerList className="sm:grid-cols-1">
              <CardMaterial material={data.group.material} />
            </ContainerList>
          </LayoutContent>
          <FooterContent>
            <RefContent
              githubUrl={getGithubUrl({
                path: `/packages/contents/material/practice/assessment/${data.group.sourceType}/${data.group.sourceMaterial}`,
              })}
            />
          </FooterContent>
        </LayoutMaterialContent>
        <LayoutMaterialToc
          chapters={{
            label: t("exercises"),
            data: [
              {
                label: data.group.material.title,
                href: `#${headingId}`,
                children: [],
              },
            ],
          }}
          header={{
            title: data.group.material.title,
            href: data.pagePath,
            description:
              data.group.material.description ?? t(data.group.sourceType),
          }}
        />
      </LayoutMaterial>
    </>
  );
}
