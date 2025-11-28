import fs from "node:fs";
import path from "node:path";
import {
  getMaterialPath,
  getMaterials,
} from "@repo/contents/_lib/exercises/material";
import { getExercisesPath } from "@repo/contents/_lib/exercises/type";
import { getMaterialIcon } from "@repo/contents/_lib/subject/material";
import type { ExercisesCategory } from "@repo/contents/_types/exercises/category";
import type { ExercisesMaterial } from "@repo/contents/_types/exercises/material";
import type { ExercisesType } from "@repo/contents/_types/exercises/type";
import type { ParsedHeading } from "@repo/contents/_types/toc";
import { slugify } from "@repo/design-system/lib/utils";
import { BreadcrumbJsonLd } from "@repo/seo/json-ld/breadcrumb";
import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
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
import { getGithubUrl } from "@/lib/utils/github";
import { getOgUrl } from "@/lib/utils/metadata";
import { getStaticParams } from "@/lib/utils/system";

export const revalidate = false;

type Params = {
  locale: Locale;
  category: ExercisesCategory;
  type: ExercisesType;
  material: ExercisesMaterial;
};

type Props = {
  params: Promise<Params>;
};

export async function generateMetadata({
  params,
}: {
  params: Props["params"];
}): Promise<Metadata> {
  const { locale, category, type, material } = await params;
  const t = await getTranslations({ locale, namespace: "Exercises" });

  const FilePath = getMaterialPath(category, type, material);

  let ogUrl: string = getOgUrl(locale, FilePath);

  const publicPath = `/open-graph/exercises/${locale}-${material}.png` as const;
  const fullPathToCheck = path.join(process.cwd(), `public${publicPath}`);

  // if the og image exists in public directory, use it
  if (fs.existsSync(fullPathToCheck)) {
    ogUrl = publicPath;
  }

  const title = `${t(material)} - ${t(type)} - ${t(category)}`;
  const urlPath = `/${locale}${FilePath}`;
  const image = {
    url: ogUrl,
    width: 1200,
    height: 630,
  };

  return {
    title: {
      absolute: title,
    },
    alternates: {
      canonical: urlPath,
    },
    openGraph: {
      title,
      url: urlPath,
      siteName: "Nakafa",
      locale,
      type: "website",
      images: [image],
    },
    twitter: {
      images: [image],
    },
  };
}

export function generateStaticParams() {
  return getStaticParams({
    basePath: "exercises",
    paramNames: ["category", "type", "material"],
  });
}

export default function Page({ params }: Props) {
  const { locale, category, type, material } = use(params);

  // Enable static rendering
  setRequestLocale(locale);

  return (
    <PageContent
      category={category}
      locale={locale}
      material={material}
      type={type}
    />
  );
}

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
  const typePath = getExercisesPath(category, type);
  const FilePath = getMaterialPath(category, type, material);

  const [materials, t] = await Promise.all([
    getMaterials(FilePath, locale),
    getTranslations({ locale, namespace: "Exercises" }),
  ]);

  const chapters: ParsedHeading[] = materials.map((mat) => ({
    label: mat.title,
    href: `#${slugify(mat.title)}`,
  }));

  return (
    <>
      <BreadcrumbJsonLd
        breadcrumbItems={materials.map((mat, index) => ({
          "@type": "ListItem",
          "@id": `https://nakafa.com/${locale}${mat.href}`,
          position: index + 1,
          name: mat.title,
          item: `https://nakafa.com/${locale}${mat.href}`,
        }))}
        locale={locale}
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
                  <CardMaterial key={mat.title} material={mat} />
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
