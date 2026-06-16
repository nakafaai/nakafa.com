import { getExercisesPath } from "@repo/contents/_lib/assessment/route";
import type {
  ExercisesCategory,
  ExercisesMaterial,
  ExercisesType,
} from "@repo/contents/_types/taxonomy";
import { slugify } from "@repo/design-system/lib/utils";
import { BreadcrumbJsonLd } from "@repo/seo/json-ld/breadcrumb";
import { CollectionPageJsonLd } from "@repo/seo/json-ld/collection-page";
import type { Locale } from "next-intl";
import { getTranslations } from "next-intl/server";
import type { ExerciseRouteData } from "@/app/[locale]/(app)/(shared)/(main)/(learn)/assessment/[category]/[type]/[material]/[...slug]/data";
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
import { createBreadcrumbItems } from "@/lib/utils/seo/breadcrumbs";

/** Renders the year-group overview variant for one exercises route. */
export async function YearGroupPage({
  category,
  data,
  locale,
  material,
  type,
}: {
  category: ExercisesCategory;
  data: Extract<ExerciseRouteData, { kind: "year-group" }>;
  locale: Locale;
  material: ExercisesMaterial;
  type: ExercisesType;
}) {
  const [t, tCommon] = await Promise.all([
    getTranslations({ locale, namespace: "Exercises" }),
    getTranslations({ locale, namespace: "Common" }),
  ]);
  const typePath = getExercisesPath(category, type);
  const headingId = slugify(data.currentMaterial.title);

  return (
    <>
      <BreadcrumbJsonLd
        breadcrumbItems={createBreadcrumbItems(locale, [
          { name: tCommon("home"), path: "" },
          { name: t(type), path: typePath },
          { name: t(material), path: data.materialPath },
          { name: data.currentMaterial.title, path: data.pagePath },
        ])}
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
