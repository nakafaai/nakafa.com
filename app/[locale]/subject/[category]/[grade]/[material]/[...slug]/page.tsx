import { BreadcrumbJsonLd } from "@/components/json-ld/breadcrumb";
import {
  LayoutMaterialContent,
  LayoutMaterialFooter,
  LayoutMaterialHeader,
  LayoutMaterialMain,
  LayoutMaterialPagination,
  LayoutMaterialTableOfContents,
} from "@/components/shared/layout-material";
import { RefContent } from "@/components/shared/ref-content";
import { SkeletonText } from "@/components/shared/skeleton-text";
import { sanitizeSlug } from "@/lib/utils";
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
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";

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
  const t = await getTranslations("Common");

  // Enable static rendering
  setRequestLocale(locale);

  const materialPath = getMaterialPath(category, grade, material);
  const FILE_PATH = getSlugPath(category, grade, material, slug);

  // Means it only contains the chapter name, not the section name
  // The slugs usually have 2 items, chapter and section
  // In the future, we can add a new page specifically for the section
  if (slug.length === 1) {
    redirect(materialPath);
  }

  try {
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

    return (
      <>
        <BreadcrumbJsonLd
          locale={locale}
          // this will only work for the first heading, not for the nested headings
          breadcrumbItems={headings.map((heading, index) => ({
            "@type": "ListItem",
            "@id": `https://nakafa.com/${locale}${FILE_PATH}${heading.href}`,
            position: index + 1,
            name: heading.label,
            item: `https://nakafa.com/${locale}${FILE_PATH}${heading.href}`,
          }))}
        />
        <LayoutMaterialContent>
          <LayoutMaterialHeader
            title={metadata.title}
            icon={getMaterialIcon(material)}
            link={{
              href: `${materialPath}#${sanitizeSlug(metadata.subject ?? "")}`,
              label: metadata.subject ?? "",
            }}
          />
          <Suspense fallback={<SkeletonText />}>
            <LayoutMaterialMain>
              <Content />
            </LayoutMaterialMain>
          </Suspense>
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
