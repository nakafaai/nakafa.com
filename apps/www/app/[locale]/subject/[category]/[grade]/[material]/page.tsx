import fs from "node:fs";
import path from "node:path";
import {
  getGradeNonNumeric,
  getGradePath,
} from "@repo/contents/_lib/subject/grade";
import {
  getMaterialIcon,
  getMaterialPath,
  getMaterials,
} from "@repo/contents/_lib/subject/material";
import type { SubjectCategory } from "@repo/contents/_types/subject/category";
import type { Grade } from "@repo/contents/_types/subject/grade";
import type { Material } from "@repo/contents/_types/subject/material";
import type { ParsedHeading } from "@repo/contents/_types/toc";
import { slugify } from "@repo/design-system/lib/utils";
import { BreadcrumbJsonLd } from "@repo/seo/json-ld/breadcrumb";
import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CardMaterial } from "@/components/shared/card-material";
import { ComingSoon } from "@/components/shared/coming-soon";
import { ContainerList } from "@/components/shared/container-list";
import {
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
  category: SubjectCategory;
  grade: Grade;
  material: Material;
};

type Props = {
  params: Promise<Params>;
};

export async function generateMetadata({
  params,
}: {
  params: Props["params"];
}): Promise<Metadata> {
  const { locale, category, grade, material } = await params;
  const t = await getTranslations("Subject");

  const FILE_PATH = getMaterialPath(category, grade, material);

  let ogUrl: string = getOgUrl(locale, FILE_PATH);

  const publicPath = `/subject/${locale}-${material}.png` as const;
  const fullPathToCheck = path.join(process.cwd(), `public${publicPath}`);

  // if the og image exists in public directory, use it
  if (fs.existsSync(fullPathToCheck)) {
    ogUrl = publicPath;
  }

  const urlPath = `/${locale}${FILE_PATH}`;
  const image = {
    url: ogUrl,
    width: 1200,
    height: 630,
  };

  return {
    title: {
      absolute: `${t(material)} - ${t(getGradeNonNumeric(grade) ?? "grade", { grade })} - ${t(category)}`,
    },
    alternates: {
      canonical: urlPath,
    },
    openGraph: {
      url: urlPath,
      images: [image],
    },
    twitter: {
      images: [image],
    },
  };
}

export function generateStaticParams() {
  return getStaticParams({
    basePath: "subject",
    paramNames: ["category", "grade", "material"],
  });
}

export default async function Page({ params }: Props) {
  const { locale, category, grade, material } = await params;
  const t = await getTranslations("Subject");

  setRequestLocale(locale);

  const gradePath = getGradePath(category, grade);
  const FILE_PATH = getMaterialPath(category, grade, material);

  const materials = await getMaterials(FILE_PATH, locale);

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
      <LayoutMaterialContent>
        <LayoutMaterialHeader
          icon={getMaterialIcon(material)}
          link={{
            href: gradePath,
            label: t(getGradeNonNumeric(grade) ?? "grade", { grade }),
          }}
          title={t(material)}
        />
        <LayoutMaterialMain className="py-10">
          {materials.length === 0 ? (
            <ComingSoon className="pb-10" />
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
            githubUrl={getGithubUrl({ path: `/contents${FILE_PATH}` })}
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
          href: FILE_PATH,
          description: t(getGradeNonNumeric(grade) ?? "grade", { grade }),
        }}
      />
    </>
  );
}
