import fs from "node:fs";
import path from "node:path";
import { parseSubjectCategory } from "@repo/contents/_lib/subject/category";
import {
  getGradeNonNumeric,
  getGradePath,
  parseGrade,
} from "@repo/contents/_lib/subject/grade";
import { getMaterialIcon } from "@repo/contents/_lib/subject/material";
import {
  getMaterialPath,
  parseMaterial,
} from "@repo/contents/_lib/subject/route";
import type {
  Grade,
  Material,
  SubjectCategory,
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
import { getRuntimeSubjectMaterials } from "@/lib/content/navigation";
import { getLocaleOrThrow } from "@/lib/i18n/params";
import { getGithubUrl } from "@/lib/utils/github";
import { getOgUrl, getSocialMetadata } from "@/lib/utils/metadata";
import { createLocalizedAlternates } from "@/lib/utils/seo/alternates";
import { createBreadcrumbItems } from "@/lib/utils/seo/breadcrumbs";
import { createSEODescription } from "@/lib/utils/seo/descriptions";
import { createSEOTitle } from "@/lib/utils/seo/titles";
import { getStaticParams } from "@/lib/utils/system";

async function getResolvedParams(
  params: PageProps<"/[locale]/subject/[category]/[grade]/[material]">["params"]
) {
  const {
    locale: rawLocale,
    category: rawCategory,
    grade: rawGrade,
    material: rawMaterial,
  } = await params;
  const locale = getLocaleOrThrow(rawLocale);
  const category = parseSubjectCategory(rawCategory);
  const grade = parseGrade(rawGrade);
  const material = parseMaterial(rawMaterial);

  if (
    Option.isNone(category) ||
    Option.isNone(grade) ||
    Option.isNone(material)
  ) {
    notFound();
  }

  return {
    category: category.value,
    grade: grade.value,
    locale,
    material: material.value,
  };
}

export async function generateMetadata({
  params,
}: {
  params: PageProps<"/[locale]/subject/[category]/[grade]/[material]">["params"];
}): Promise<Metadata> {
  const { locale, category, grade, material } = await getResolvedParams(params);
  const t = await getTranslations({ locale, namespace: "Subject" });

  const FilePath = getMaterialPath(category, grade, material);

  let ogUrl: string = getOgUrl(locale, FilePath);

  const publicPath = `/open-graph/subject/${locale}-${material}.png` as const;
  const fullPathToCheck = path.join(process.cwd(), `public${publicPath}`);

  // if the og image exists in public directory, use it
  if (fs.existsSync(fullPathToCheck)) {
    ogUrl = publicPath;
  }

  const gradeLabel = t(
    Option.getOrElse(getGradeNonNumeric(grade), () => "grade"),
    {
      grade,
    }
  );
  const title = createSEOTitle([t(material), gradeLabel, t(category)]);
  const urlPath = `/${locale}${FilePath}`;
  const description = createSEODescription([
    t(material),
    gradeLabel,
    t(category),
    t("grade-description"),
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
    basePath: "subject",
    paramNames: ["category", "grade", "material"],
  });
}

export default function Page(
  props: PageProps<"/[locale]/subject/[category]/[grade]/[material]">
) {
  const { params } = props;
  const {
    locale: rawLocale,
    category: rawCategory,
    grade: rawGrade,
    material: rawMaterial,
  } = use(params);
  const locale = getLocaleOrThrow(rawLocale);
  const category = parseSubjectCategory(rawCategory);
  const grade = parseGrade(rawGrade);
  const material = parseMaterial(rawMaterial);

  if (
    Option.isNone(category) ||
    Option.isNone(grade) ||
    Option.isNone(material)
  ) {
    notFound();
  }

  return (
    <PageContent
      category={category.value}
      grade={grade.value}
      locale={locale}
      material={material.value}
    />
  );
}

async function PageContent({
  locale,
  category,
  grade,
  material,
}: {
  locale: Locale;
  category: SubjectCategory;
  grade: Grade;
  material: Material;
}) {
  "use cache";

  cacheLife("seconds");

  const gradePath = getGradePath(category, grade);
  const FilePath = getMaterialPath(category, grade, material);

  const [t, tCommon, materials] = await Promise.all([
    getTranslations({ locale, namespace: "Subject" }),
    getTranslations({ locale, namespace: "Common" }),
    Effect.runPromise(getRuntimeSubjectMaterials(FilePath, locale)),
  ]);
  const gradeLabel = t(
    Option.getOrElse(getGradeNonNumeric(grade), () => "grade"),
    {
      grade,
    }
  );

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
          { name: tCommon("subject"), path: "/subject" },
          {
            name: gradeLabel,
            path: gradePath,
          },
          { name: t(material), path: FilePath },
        ])}
      />
      <CollectionPageJsonLd
        description={gradeLabel}
        items={materials.map((mat) => ({
          url: `https://nakafa.com/${locale}${mat.href}`,
          name: mat.title,
        }))}
        name={`${t(material)} - ${gradeLabel}`}
        url={`https://nakafa.com/${locale}${FilePath}`}
      />
      <LayoutMaterial>
        <LayoutMaterialContent>
          <LayoutMaterialHeader
            icon={getMaterialIcon(material)}
            link={{
              href: gradePath,
              label: gradeLabel,
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
            label: t("chapter"),
            data: chapters,
          }}
          header={{
            title: t(material),
            href: FilePath,
            description: gradeLabel,
          }}
        />
      </LayoutMaterial>
    </>
  );
}
