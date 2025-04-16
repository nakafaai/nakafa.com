import { CardMaterial } from "@/components/shared/card-material";
import { ContainerList } from "@/components/shared/container-list";
import {
  LayoutMaterial,
  LayoutMaterialContent,
  LayoutMaterialFooter,
  LayoutMaterialHeader,
} from "@/components/shared/layout-material";
import { RefContent } from "@/components/shared/ref-content";
import type { ParsedHeading } from "@/components/shared/sidebar-tree";
import { getGithubUrl } from "@/lib/utils/github";
import { getGradePath } from "@/lib/utils/subject/grade";
import {
  getMaterialIcon,
  getMaterialPath,
  getMaterials,
} from "@/lib/utils/subject/material";
import { getStaticParams } from "@/lib/utils/system";
import type { SubjectCategory } from "@/types/subject/category";
import type { Grade } from "@/types/subject/grade";
import type { MaterialGrade } from "@/types/subject/material";
import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";

type Params = {
  locale: Locale;
  category: SubjectCategory;
  grade: Grade;
  material: MaterialGrade;
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

  return {
    title: t(material),
    alternates: {
      canonical: `/${locale}${FILE_PATH}`,
    },
  };
}

export function generateStaticParams() {
  return getStaticParams({
    basePath: "contents/subject",
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

  const chapters: ParsedHeading[] = materials.map((material) => ({
    label: material.title,
    href: `#${material.title.toLowerCase().replace(/\s+/g, "-")}`,
  }));

  return (
    <LayoutMaterial
      chapters={{
        data: chapters,
      }}
    >
      <LayoutMaterialHeader
        header={{
          title: t(material),
          icon: getMaterialIcon(material),
          link: {
            href: gradePath,
            label: t("grade", { grade }),
          },
        }}
      />
      <LayoutMaterialContent className="py-10">
        <ContainerList className="sm:grid-cols-1">
          {materials.map((material) => (
            <CardMaterial key={material.title} material={material} />
          ))}
        </ContainerList>
      </LayoutMaterialContent>
      <LayoutMaterialFooter>
        <RefContent githubUrl={getGithubUrl(FILE_PATH)} />
      </LayoutMaterialFooter>
    </LayoutMaterial>
  );
}
