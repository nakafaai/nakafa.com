import { getGradeNonNumeric } from "@repo/contents/_lib/subject/grade";
import {
  getMaterialIcon,
  getMaterialPath,
} from "@repo/contents/_lib/subject/material";
import {
  getMaterialsPagination,
  getSlugPath,
} from "@repo/contents/_lib/subject/slug";
import { getHeadings } from "@repo/contents/_lib/toc";
import type { SubjectCategory } from "@repo/contents/_types/subject/category";
import type { Grade } from "@repo/contents/_types/subject/grade";
import type { Material } from "@repo/contents/_types/subject/material";
import { slugify } from "@repo/design-system/lib/utils";
import { ArticleJsonLd } from "@repo/seo/json-ld/article";
import { BreadcrumbJsonLd } from "@repo/seo/json-ld/breadcrumb";
import { LearningResourceJsonLd } from "@repo/seo/json-ld/learning-resource";
import { formatISO } from "date-fns";
import { Effect } from "effect";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { use } from "react";
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
import {
  getContentContext,
  getContentMetadataContext,
} from "@/lib/utils/pages/subject";
import { createSEODescription } from "@/lib/utils/seo/descriptions";
import { createSEOTitle } from "@/lib/utils/seo/titles";
import { getStaticParams } from "@/lib/utils/system";

export const revalidate = false;

interface Params {
  category: SubjectCategory;
  grade: Grade;
  locale: Locale;
  material: Material;
  slug: string[];
}

interface Props {
  params: Promise<Params>;
}

export async function generateMetadata({
  params,
}: {
  params: Props["params"];
}): Promise<Metadata> {
  const { locale, category, grade, material, slug } = await params;
  const t = await getTranslations({ locale, namespace: "Subject" });

  const { content, FilePath } = await Effect.runPromise(
    Effect.match(
      getContentMetadataContext({ locale, category, grade, material, slug }),
      {
        onFailure: () => ({
          content: null,
          FilePath: getSlugPath(category, grade, material, slug),
        }),
        onSuccess: (data) => data,
      }
    )
  );

  const metadata = content?.metadata ?? null;

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

  // Build SEO-optimized title with smart truncation
  // Priority: content title > subject > material > grade > category
  const title = createSEOTitle([
    metadata?.title,
    metadata?.subject,
    t(material),
    t(getGradeNonNumeric(grade) ?? "grade", { grade }),
    t(category),
  ]);

  if (!metadata) {
    return {
      title: {
        absolute: title,
      },
      alternates,
      openGraph,
      twitter,
    };
  }

  // Build SEO description from content parts
  const description = createSEODescription([
    metadata.description,
    `${metadata.title} - ${t("learn-with-nakafa")}`,
  ]);

  return {
    title: {
      absolute: title,
    },
    description,
    alternates,
    authors: metadata.authors,
    category: t(material),
    keywords: metadata.title
      .split(" ")
      .concat(metadata.description?.split(" ") ?? [])
      .filter((keyword: string) => keyword.length > 0),
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

export default function Page({ params }: Props) {
  const { locale, category, grade, material, slug } = use(params);

  // Enable static rendering
  setRequestLocale(locale);

  return (
    <PageContent
      category={category}
      grade={grade}
      locale={locale}
      material={material}
      slug={slug}
    />
  );
}

async function PageContent({
  locale,
  category,
  grade,
  material,
  slug,
}: {
  locale: Locale;
  category: SubjectCategory;
  grade: Grade;
  material: Material;
  slug: string[];
}) {
  const [tCommon, tSubject] = await Promise.all([
    getTranslations({ locale, namespace: "Common" }),
    getTranslations({ locale, namespace: "Subject" }),
  ]);

  if (slug.length === 1) {
    // Means it only contains the chapter name, not the section name
    // The slugs usually have 2 items, chapter and section
    // In the future, we can add a new page specifically for the section
    const materialPath = getSlugPath(category, grade, material, []);
    redirect(materialPath);
  }

  const FilePath = getSlugPath(category, grade, material, slug);
  const materialPath = getMaterialPath(category, grade, material);

  const result = await Effect.runPromise(
    Effect.match(
      getContentContext({ locale, category, grade, material, slug }),
      {
        onFailure: () => ({
          content: null,
          materials: null,
          materialPath,
          FilePath,
        }),
        onSuccess: (data) => data,
      }
    )
  );

  const { content, materials } = result;

  if (!(content && materials)) {
    notFound();
  }

  const { metadata, default: Content, raw } = content;

  const pagination = getMaterialsPagination(FilePath, materials);

  const headings = getHeadings(raw);

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
      />
      <ArticleJsonLd
        author={metadata.authors.map((author: { name: string }) => ({
          "@type": "Person",
          name: author.name,
          url: `https://nakafa.com/${locale}/contributor`,
        }))}
        datePublished={formatISO(metadata.date)}
        description={metadata.description ?? metadata.subject ?? ""}
        headline={metadata.title}
        image={getOgUrl(locale, FilePath)}
        url={`/${locale}${FilePath}`}
      />
      <LearningResourceJsonLd
        author={metadata.authors.map((author: { name: string }) => ({
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
            content={raw}
            icon={getMaterialIcon(material)}
            link={{
              href: `${materialPath}#${slugify(metadata.subject ?? "")}`,
              label: metadata.subject ?? "",
            }}
            slug={`/${locale}${FilePath}`}
            title={metadata.title}
          />
          <LayoutMaterialMain>
            {headings.length === 0 && <ComingSoon />}
            {headings.length > 0 && Content}
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
}
