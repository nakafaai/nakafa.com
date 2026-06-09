import fs from "node:fs";
import path from "node:path";
import {
  getExercisesPath,
  getMaterialPath,
  parseExercisesCategory,
  parseExercisesMaterial,
  parseExercisesType,
} from "@repo/contents/_lib/exercises/route";
import { getMaterialIcon } from "@repo/contents/_lib/subject/material";
import type {
  ExercisesCategory,
  ExercisesMaterial,
  ExercisesType,
} from "@repo/contents/_types/taxonomy";
import type { ParsedHeading } from "@repo/contents/_types/toc";
import { slugify } from "@repo/design-system/lib/utils";
import { BreadcrumbJsonLd } from "@repo/seo/json-ld/breadcrumb";
import { CollectionPageJsonLd } from "@repo/seo/json-ld/collection-page";
import { Effect, Option } from "effect";
import type { Metadata } from "next";
import { cacheLife } from "next/cache";
import { notFound } from "next/navigation";
import type { Locale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { use } from "react";
import { CardMaterial } from "@/components/shared/card-material";
import { ComingSoon } from "@/components/shared/coming-soon";
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
import { getRuntimeExerciseMaterials } from "@/lib/content/navigation";
import { getLocaleOrThrow } from "@/lib/i18n/params";
import { getGithubUrl } from "@/lib/utils/github";
import { getOgUrl, getSocialMetadata } from "@/lib/utils/metadata";
import { createLocalizedAlternates } from "@/lib/utils/seo/alternates";
import { createBreadcrumbItems } from "@/lib/utils/seo/breadcrumbs";
import { createSEODescription } from "@/lib/utils/seo/descriptions";
import { createSEOTitle } from "@/lib/utils/seo/titles";
import { getStaticParams } from "@/lib/utils/system";

async function getResolvedParams(
  params: PageProps<"/[locale]/exercises/[category]/[type]/[material]">["params"]
) {
  const {
    locale: rawLocale,
    category: rawCategory,
    type: rawType,
    material: rawMaterial,
  } = await params;
  const locale = getLocaleOrThrow(rawLocale);
  const parsedCategory = parseExercisesCategory(rawCategory);
  const parsedType = parseExercisesType(rawType);
  const parsedMaterial = parseExercisesMaterial(rawMaterial);

  if (
    Option.isNone(parsedCategory) ||
    Option.isNone(parsedType) ||
    Option.isNone(parsedMaterial)
  ) {
    notFound();
  }

  const category = parsedCategory.value;
  const type = parsedType.value;
  const material = parsedMaterial.value;

  return { category, locale, material, type };
}

export async function generateMetadata({
  params,
}: {
  params: PageProps<"/[locale]/exercises/[category]/[type]/[material]">["params"];
}): Promise<Metadata> {
  const { locale, category, type, material } = await getResolvedParams(params);
  const t = await getTranslations({ locale, namespace: "Exercises" });

  const FilePath = getMaterialPath(category, type, material);

  let ogUrl: string = getOgUrl(locale, FilePath);

  const publicPath = `/open-graph/subject/${locale}-${material}.png` as const;
  const fullPathToCheck = path.join(process.cwd(), `public${publicPath}`);

  // if the og image exists in public directory, use it
  if (fs.existsSync(fullPathToCheck)) {
    ogUrl = publicPath;
  }

  const title = createSEOTitle([t(material), t(type), t(category)]);
  const urlPath = `/${locale}${FilePath}`;

  const description = createSEODescription([
    t(material),
    t(type),
    t(category),
    t("type-description"),
    t("practice-exercises"),
  ]);
  const socialMetadata = getSocialMetadata({
    title,
    description,
    locale,
    path: urlPath,
    image: ogUrl,
  });

  return {
    title: {
      absolute: title,
    },
    description,
    alternates: createLocalizedAlternates(urlPath),
    ...socialMetadata,
  };
}

export function generateStaticParams() {
  return getStaticParams({
    basePath: "exercises",
    paramNames: ["category", "type", "material"],
  });
}

export default function Page(
  props: PageProps<"/[locale]/exercises/[category]/[type]/[material]">
) {
  const { params } = props;
  const {
    locale: rawLocale,
    category: rawCategory,
    type: rawType,
    material: rawMaterial,
  } = use(params);
  const locale = getLocaleOrThrow(rawLocale);
  const parsedCategory = parseExercisesCategory(rawCategory);
  const parsedType = parseExercisesType(rawType);
  const parsedMaterial = parseExercisesMaterial(rawMaterial);

  if (
    Option.isNone(parsedCategory) ||
    Option.isNone(parsedType) ||
    Option.isNone(parsedMaterial)
  ) {
    notFound();
  }

  const category = parsedCategory.value;
  const type = parsedType.value;
  const material = parsedMaterial.value;

  return (
    <PageContent
      category={category}
      locale={locale}
      material={material}
      type={type}
    />
  );
}

/** Renders an exercise material index from grouped Convex route rows. */
async function PageContent({
  locale,
  category,
  type,
  material,
}: {
  locale: Locale;
  category: ExercisesCategory;
  type: ExercisesType;
  material: ExercisesMaterial;
}) {
  "use cache";

  cacheLife("seconds");

  const typePath = getExercisesPath(category, type);
  const FilePath = getMaterialPath(category, type, material);

  const [t, tCommon, materials] = await Promise.all([
    getTranslations({ locale, namespace: "Exercises" }),
    getTranslations({ locale, namespace: "Common" }),
    Effect.runPromise(getRuntimeExerciseMaterials(FilePath, locale)),
  ]);

  const chapters: ParsedHeading[] = materials.map((mat) => ({
    label: mat.title,
    href: `#${slugify(mat.title)}`,
    children: [],
  }));

  return (
    <>
      <BreadcrumbJsonLd
        breadcrumbItems={createBreadcrumbItems(locale, [
          { name: tCommon("home"), path: "" },
          { name: t(type), path: typePath },
          { name: t(material), path: FilePath },
        ])}
      />
      <CollectionPageJsonLd
        description={t(type)}
        items={materials.map((mat) => ({
          url: `https://nakafa.com/${locale}${mat.href}`,
          name: mat.title,
        }))}
        name={`${t(material)} - ${t(type)}`}
        url={`https://nakafa.com/${locale}${FilePath}`}
      />
      <LayoutMaterial>
        <LayoutMaterialContent>
          <LayoutMaterialHeader
            icon={getMaterialIcon(material)}
            link={{
              href: typePath,
              label: t(type),
            }}
            title={t(material)}
          />
          <LayoutMaterialMain>
            {materials.length === 0 ? (
              <ComingSoon />
            ) : (
              <ContainerList className="sm:grid-cols-1">
                {materials.map((mat) => (
                  <CardMaterial key={mat.href} material={mat} />
                ))}
              </ContainerList>
            )}
          </LayoutMaterialMain>
          <LayoutMaterialFooter>
            <RefContent
              githubUrl={getGithubUrl({
                path: `/packages/contents${FilePath}`,
              })}
            />
          </LayoutMaterialFooter>
        </LayoutMaterialContent>
        <LayoutMaterialToc
          chapters={{
            label: t("exercises"),
            data: chapters,
          }}
          header={{
            title: t(material),
            href: FilePath,
            description: t(type),
          }}
        />
      </LayoutMaterial>
    </>
  );
}
