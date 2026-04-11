import type { ExercisesMaterial } from "@repo/contents/_types/exercises/material";
import type { ExercisesType } from "@repo/contents/_types/exercises/type";
import { slugify } from "@repo/design-system/lib/utils";
import { BreadcrumbJsonLd } from "@repo/seo/json-ld/breadcrumb";
import { CollectionPageJsonLd } from "@repo/seo/json-ld/collection-page";
import type { Locale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { CardMaterial } from "@/components/shared/card-material";
import { ContainerList } from "@/components/shared/container-list";
import {
  LayoutMaterial,
  LayoutMaterialContent,
  LayoutMaterialFooter,
  LayoutMaterialHeader,
  LayoutMaterialMain,
  LayoutMaterialToc,
} from "@/components/shared/layout-material";
import { RefContent } from "@/components/shared/ref-content";
import { getGithubUrl } from "@/lib/utils/github";
import type { ExerciseRouteData } from "./page-data";

/** Renders the year-group overview variant for one exercises route. */
export async function YearGroupPage({
  data,
  locale,
  material,
  type,
}: {
  data: Extract<ExerciseRouteData, { kind: "year-group" }>;
  locale: Locale;
  material: ExercisesMaterial;
  type: ExercisesType;
}) {
  const t = await getTranslations({ locale, namespace: "Exercises" });
  const headingId = slugify(data.currentMaterial.title);

  return (
    <>
      <BreadcrumbJsonLd
        breadcrumbItems={data.currentMaterial.items.map((item, index) => ({
          "@type": "ListItem",
          "@id": `https://nakafa.com/${locale}${item.href}`,
          position: index + 1,
          name: item.title,
          item: `https://nakafa.com/${locale}${item.href}`,
        }))}
      />
      <CollectionPageJsonLd
        description={data.currentMaterial.description ?? t(type)}
        items={data.currentMaterial.items.map((item) => ({
          url: `https://nakafa.com/${locale}${item.href}`,
          name: item.title,
        }))}
        name={`${t(material)} - ${data.currentMaterial.title}`}
        url={`https://nakafa.com/${locale}${data.pagePath}`}
      />
      <LayoutMaterial>
        <LayoutMaterialContent>
          <LayoutMaterialHeader
            link={{
              href: data.materialPath,
              label: t(material),
            }}
            title={data.currentMaterial.title}
          />
          <LayoutMaterialMain>
            <ContainerList className="sm:grid-cols-1">
              <CardMaterial material={data.currentMaterial} />
            </ContainerList>
          </LayoutMaterialMain>
          <LayoutMaterialFooter>
            <RefContent
              githubUrl={getGithubUrl({
                path: `/packages/contents${data.pagePath}`,
              })}
            />
          </LayoutMaterialFooter>
        </LayoutMaterialContent>
        <LayoutMaterialToc
          chapters={{
            label: t("exercises"),
            data: [
              {
                label: data.currentMaterial.title,
                href: `#${headingId}`,
                children: [],
              },
            ],
          }}
          header={{
            title: data.currentMaterial.title,
            href: data.pagePath,
            description: data.currentMaterial.description ?? t(type),
          }}
        />
      </LayoutMaterial>
    </>
  );
}
