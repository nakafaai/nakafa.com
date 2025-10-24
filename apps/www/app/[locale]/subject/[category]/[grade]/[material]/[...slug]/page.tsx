import { getGradeNonNumeric } from "@repo/contents/_lib/subject/grade";
import {
  getMaterialIcon,
  getMaterialPath,
  getMaterials,
} from "@repo/contents/_lib/subject/material";
import {
  getMaterialsPagination,
  getSlugPath,
} from "@repo/contents/_lib/subject/slug";
import { getHeadings } from "@repo/contents/_lib/toc";
import { getContent } from "@repo/contents/_lib/utils";
import type { SubjectCategory } from "@repo/contents/_types/subject/category";
import type { Grade } from "@repo/contents/_types/subject/grade";
import type { Material } from "@repo/contents/_types/subject/material";
import { slugify } from "@repo/design-system/lib/utils";
import { ArticleJsonLd } from "@repo/seo/json-ld/article";
import { BreadcrumbJsonLd } from "@repo/seo/json-ld/breadcrumb";
import { LearningResourceJsonLd } from "@repo/seo/json-ld/learning-resource";
import { formatISO } from "date-fns";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Comments } from "@/components/comments";
import { ComingSoon } from "@/components/shared/coming-soon";
import {
  LayoutMaterial,
  LayoutMaterialContent,
  LayoutMaterialFooter,
  LayoutMaterialHeader,
  LayoutMaterialMain,
  LayoutMaterialPagination,
  LayoutMaterialToc,
} from "@/components/shared/layout-material";
import { getGithubUrl } from "@/lib/utils/github";
import { getOgUrl } from "@/lib/utils/metadata";
import { getStaticParams } from "@/lib/utils/system";

export const revalidate = false;

type Params = {
  locale: Locale;
  category: SubjectCategory;
  grade: Grade;
  material: Material;
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

  const FilePath = getSlugPath(category, grade, material, slug);

  const content = await getContent(locale, FilePath);

  const path = `/${locale}${FilePath}`;
  const alternates = {
    canonical: path,
  };
  const image = {
    url: getOgUrl(locale, FilePath),
    width: 1200,
    height: 630,
  };
  const twitter: Metadata["twitter"] = {
    images: [image],
  };
  const openGraph: Metadata["openGraph"] = {
    url: path,
    images: [image],
    type: "article",
    siteName: "Nakafa",
    locale,
  };

  const defaultTitle = `${t(material)} - ${t(getGradeNonNumeric(grade) ?? "grade", { grade })} - ${t(category)}`;

  if (!content) {
    return {
      title: {
        absolute: defaultTitle,
      },
      alternates,
      openGraph,
      twitter,
    };
  }

  const { metadata } = content;

  return {
    title: {
      absolute: `${metadata.title} - ${metadata.subject} - ${defaultTitle}`,
    },
    description: metadata.description ?? metadata.subject ?? "",
    alternates,
    authors: metadata.authors,
    category: t(material),
    keywords: metadata.title
      .split(" ")
      .concat(metadata.description?.split(" ") ?? [])
      .filter((keyword) => keyword.length > 0),
    openGraph,
    twitter,
  };
}

export function generateStaticParams() {
  return getStaticParams({
    basePath: "subject",
    paramNames: ["category", "grade", "material", "slug"],
    slugParam: "slug",
    isDeep: true,
  });
}

export default async function Page({ params }: Props) {
  const { locale, category, grade, material, slug } = await params;

  const [tCommon, tSubject] = await Promise.all([
    getTranslations("Common"),
    getTranslations("Subject"),
  ]);

  // Enable static rendering
  setRequestLocale(locale);

  const materialPath = getMaterialPath(category, grade, material);
  const FilePath = getSlugPath(category, grade, material, slug);

  // Means it only contains the chapter name, not the section name
  // The slugs usually have 2 items, chapter and section
  // In the future, we can add a new page specifically for the section
  if (slug.length === 1) {
    redirect(materialPath);
  }

  try {
    const [content, pagination] = await Promise.all([
      getContent(locale, FilePath),
      getMaterials(materialPath, locale).then((materials) =>
        getMaterialsPagination(FilePath, materials),
      ),
    ]);

    if (!content) {
      notFound();
    }

    const { metadata, default: Content } = content;

    const headings = getHeadings(content.raw);

    return (
      <>
        <BreadcrumbJsonLd
          breadcrumbItems={headings.map((heading, index) => ({
            "@type": "ListItem",
            "@id": `https://nakafa.com/${locale}${FilePath}${heading.href}`,
            position: index + 1,
            name: heading.label,
            item: `https://nakafa.com/${locale}${FilePath}${heading.href}`,
          }))}
          locale={locale}
          // this will only work for the first heading, not for the nested headings
          name={metadata.title}
        />
        <ArticleJsonLd
          author={metadata.authors.map((author) => ({
            "@type": "Person",
            name: author.name,
            url: `https://nakafa.com/${locale}/contributor`,
          }))}
          datePublished={formatISO(metadata.date)}
          description={metadata.description ?? metadata.subject ?? ""}
          headline={metadata.title}
          image={getOgUrl(locale, FilePath)}
        />
        <LearningResourceJsonLd
          author={metadata.authors.map((author) => ({
            "@type": "Person",
            name: author.name,
            url: `https://nakafa.com/${locale}/contributor`,
          }))}
          datePublished={formatISO(metadata.date)}
          description={metadata.description ?? metadata.subject ?? ""}
          educationalLevel={tSubject(getGradeNonNumeric(grade) ?? "grade", {
            grade,
          })}
          name={metadata.title}
        />
        <LayoutMaterial>
          <LayoutMaterialContent showAskButton>
            <LayoutMaterialHeader
              icon={getMaterialIcon(material)}
              link={{
                href: `${materialPath}#${slugify(metadata.subject ?? "")}`,
                label: metadata.subject ?? "",
              }}
              slug={`/${locale}${FilePath}`}
              title={metadata.title}
            />
            <LayoutMaterialMain>
              {headings.length === 0 ? <ComingSoon /> : <Content />}
            </LayoutMaterialMain>
            <LayoutMaterialPagination pagination={pagination} />
            <LayoutMaterialFooter>
              <Comments slug={FilePath} />
            </LayoutMaterialFooter>
          </LayoutMaterialContent>
          <LayoutMaterialToc
            chapters={{
              label: tCommon("on-this-page"),
              data: headings,
            }}
            githubUrl={getGithubUrl({
              path: `/packages/contents${FilePath}`,
            })}
            header={{
              title: metadata.title,
              href: FilePath,
              description: metadata.description ?? metadata.subject,
            }}
            showComments
          />
        </LayoutMaterial>
      </>
    );
  } catch {
    notFound();
  }
}
