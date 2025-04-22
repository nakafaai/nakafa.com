import {
  LayoutMaterialContent,
  LayoutMaterialFooter,
  LayoutMaterialHeader,
  LayoutMaterialMain,
  LayoutMaterialPagination,
  LayoutMaterialTableOfContents,
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
import { Suspense } from "react";
export const revalidate = false;

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

  const content = await getContent(locale, FILE_PATH);

  const path = `/${locale}${FILE_PATH}`;
  const alternates = {
    canonical: path,
  };
  const image = {
    url: getOgUrl(locale, FILE_PATH),
    width: 1200,
    height: 630,
  };
  const twitter = {
    images: [image],
  };

  if (!content) {
    return {
      title: t(material),
      alternates,
      openGraph: {
        url: path,
        images: [image],
      },
      twitter,
    };
  }

  const { metadata } = content;

  return {
    title: metadata.title,
    description: metadata.description ?? metadata.subject,
    alternates,
    authors: metadata.authors,
    category: t(material),
    openGraph: {
      url: path,
      images: [image],
    },
    twitter,
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
      getContent(locale, FILE_PATH),
      getRawContent(`${FILE_PATH}/${locale}.mdx`).then(getHeadings),
      getMaterials(materialPath, locale).then((materials) =>
        getMaterialsPagination(FILE_PATH, materials)
      ),
    ]);

    if (!content) {
      notFound();
    }

    const { metadata, default: Content } = content;
    const icon = getMaterialIcon(material);
    const href = `${materialPath}#${metadata.subject?.toLowerCase().replace(/\s+/g, "-")}`;

    return (
      <>
        <LayoutMaterialContent>
          <LayoutMaterialHeader
            title={metadata.title}
            description={metadata.description}
            link={{
              href,
              label: metadata.subject ?? "",
            }}
            authors={metadata.authors}
            category={{
              icon,
              name: tSubject(material),
            }}
            // Omitting date to maintain content credibility
          />
          <LayoutMaterialMain>
            <Suspense fallback={null}>
              <Content />
            </Suspense>
          </LayoutMaterialMain>
          <LayoutMaterialPagination pagination={pagination} />
          <LayoutMaterialFooter className="mt-10">
            <RefContent githubUrl={getGithubUrl(`/contents${FILE_PATH}`)} />
          </LayoutMaterialFooter>
        </LayoutMaterialContent>
        <LayoutMaterialTableOfContents
          header={{
            title: metadata.title,
            href: FILE_PATH,
            description: metadata.description ?? metadata.subject,
          }}
          chapters={{
            label: t("on-this-page"),
            data: headings,
          }}
        />
      </>
    );
  } catch {
    return notFound();
  }
}
