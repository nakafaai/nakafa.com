import {
  LayoutMaterial,
  LayoutMaterialContent,
  LayoutMaterialFooter,
  LayoutMaterialHeader,
  LayoutMaterialPagination,
} from "@/components/shared/layout-material";
import { RefContent } from "@/components/shared/ref-content";
import { getContent } from "@/lib/utils/contents";
import { getGithubUrl } from "@/lib/utils/github";
import { getHeadings } from "@/lib/utils/markdown";
import { getRawContent } from "@/lib/utils/markdown";
import { getOgUrl } from "@/lib/utils/metadata";
import {
  getMaterialIcon,
  getMaterialPath,
  getMaterials,
} from "@/lib/utils/subject/material";
import { getMaterialsPagination, getSlugPath } from "@/lib/utils/subject/slug";
import { getStaticParams } from "@/lib/utils/system";
import type { SubjectCategory } from "@/types/subject/category";
import type { Grade } from "@/types/subject/grade";
import type { MaterialGrade } from "@/types/subject/material";
import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

type Params = {
  locale: Locale;
  category: SubjectCategory;
  grade: Grade;
  material: MaterialGrade;
  slug: string[];
};

type Props = {
  params: Promise<Params>;
};

export async function generateMetadata({
  params,
}: {
  params: Props["params"];
}): Promise<Metadata> {
  const { locale, category, grade, material, slug } = await params;
  const t = await getTranslations("Subject");

  const FILE_PATH = getSlugPath(category, grade, material, slug);

  const content = await getContent(FILE_PATH);

  const image = {
    url: getOgUrl(locale, FILE_PATH),
    width: 1200,
    height: 630,
  };

  if (!content) {
    return {
      title: t(material),
      alternates: {
        canonical: `/${locale}${FILE_PATH}`,
      },
      openGraph: {
        url: `/${locale}${FILE_PATH}`,
        images: [image],
      },
    };
  }

  const { metadata } = content;

  return {
    title: `${metadata.title} - ${metadata.subject}`,
    alternates: {
      canonical: `/${locale}${FILE_PATH}`,
    },
    authors: metadata.authors,
    category: t(material),
    openGraph: {
      url: `/${locale}${FILE_PATH}`,
      images: [image],
    },
  };
}

export function generateStaticParams() {
  return getStaticParams({
    basePath: "contents/subject",
    paramNames: ["category", "grade", "material", "slug"],
    slugParam: "slug",
    isDeep: true,
  });
}

export default async function Page({ params }: Props) {
  const { locale, category, grade, material, slug } = await params;
  const [t, tSubject] = await Promise.all([
    getTranslations("Common"),
    getTranslations("Subject"),
  ]);

  // Enable static rendering
  setRequestLocale(locale);

  try {
    const materialPath = getMaterialPath(category, grade, material);
    const FILE_PATH = getSlugPath(category, grade, material, slug);

    const [content, headings, pagination] = await Promise.all([
      getContent(`${FILE_PATH}/${locale}.mdx`),
      getRawContent(`${FILE_PATH}/${locale}.mdx`).then(getHeadings),
      getMaterials(materialPath, locale).then((materials) =>
        getMaterialsPagination(FILE_PATH, materials)
      ),
    ]);

    if (!content) {
      notFound();
    }

    const { metadata, default: Content } = content;

    return (
      <LayoutMaterial
        chapters={{
          label: t("on-this-page"),
          data: headings,
        }}
      >
        <LayoutMaterialHeader
          title={metadata.title}
          description={metadata.description}
          icon={getMaterialIcon(material)}
          link={{
            href: `${materialPath}#${metadata.subject?.toLowerCase().replace(/\s+/g, "-")}`,
            label: metadata.subject ?? "",
          }}
          authors={metadata.authors}
          date={metadata.date}
          category={{
            icon: getMaterialIcon(material),
            name: tSubject(material),
          }}
        />
        <LayoutMaterialContent>
          <Content />
        </LayoutMaterialContent>
        <LayoutMaterialPagination pagination={pagination} />
        <LayoutMaterialFooter className="mt-10">
          <RefContent githubUrl={getGithubUrl(`/contents${FILE_PATH}`)} />
        </LayoutMaterialFooter>
      </LayoutMaterial>
    );
  } catch {
    return notFound();
  }
}
