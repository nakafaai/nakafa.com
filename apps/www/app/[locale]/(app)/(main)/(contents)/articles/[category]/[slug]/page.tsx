import { getSlugPath } from "@repo/contents/_lib/articles/slug";
import { getHeadings } from "@repo/contents/_lib/toc";
import type { ArticleCategory } from "@repo/contents/_types/articles/category";
import { ArticleJsonLd } from "@repo/seo/json-ld/article";
import { BreadcrumbJsonLd } from "@repo/seo/json-ld/breadcrumb";
import { LearningResourceJsonLd } from "@repo/seo/json-ld/learning-resource";
import { formatISO } from "date-fns";
import { Effect } from "effect";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
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
  LayoutMaterialToc,
} from "@/components/shared/layout-material";
import { getGithubUrl } from "@/lib/utils/github";
import { getOgUrl } from "@/lib/utils/metadata";
import {
  fetchArticleContext,
  fetchArticleMetadataContext,
} from "@/lib/utils/pages/article";
import { generateSEOMetadata } from "@/lib/utils/seo/generator";
import type { SEOContext } from "@/lib/utils/seo/types";
import { getStaticParams } from "@/lib/utils/system";

export const revalidate = false;

interface Props {
  params: Promise<{
    locale: Locale;
    category: ArticleCategory;
    slug: string;
  }>;
}

export async function generateMetadata({
  params,
}: {
  params: Props["params"];
}): Promise<Metadata> {
  const { locale, category, slug } = await params;
  const t = await getTranslations({ locale, namespace: "Articles" });

  const { content, FilePath } = await Effect.runPromise(
    Effect.match(fetchArticleMetadataContext({ locale, category, slug }), {
      onFailure: () => ({
        content: null,
        FilePath: getSlugPath(category, slug),
      }),
      onSuccess: (data) => data,
    })
  );

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

  // Get category display name from Articles namespace
  const tArticles = await getTranslations({ locale, namespace: "Articles" });
  const categoryDisplayName = tArticles(category);

  // Evidence: Use ICU-based SEO generator for type-safe, locale-aware metadata
  // Source: https://developers.google.com/search/docs/appearance/title-link
  const seoContext: SEOContext = {
    type: "article",
    category,
    data: {
      title: content?.metadata.title,
      description: content?.metadata.description,
      subject: undefined,
      displayName: categoryDisplayName,
    },
  };

  const { title, description, keywords } = await generateSEOMetadata(
    seoContext,
    locale
  );

  if (!content) {
    return {
      title: { absolute: title },
      alternates,
      openGraph,
      twitter,
    };
  }

  const { metadata } = content;

  return {
    title: { absolute: title },
    description,
    alternates,
    authors: metadata.authors,
    category: t(category),
    keywords,
    openGraph,
    twitter,
  };
}

// Generate bottom-up static params
export function generateStaticParams() {
  return getStaticParams({
    basePath: "articles",
    paramNames: ["category", "slug"],
  });
}

export default function Page({ params }: Props) {
  const { locale, category, slug } = use(params);

  // Enable static rendering
  setRequestLocale(locale);

  return <PageContent category={category} locale={locale} slug={slug} />;
}

async function PageContent({
  locale,
  category,
  slug,
}: {
  locale: Locale;
  category: ArticleCategory;
  slug: string;
}) {
  const [tCommon, tArticles] = await Promise.all([
    getTranslations({ locale, namespace: "Common" }),
    getTranslations({ locale, namespace: "Articles" }),
  ]);

  const FilePath = getSlugPath(category, slug);

  const result = await Effect.runPromise(
    Effect.match(fetchArticleContext({ locale, category, slug }), {
      onFailure: () => ({ content: null, references: null }),
      onSuccess: (data) => data,
    })
  );

  const { content, references } = result;

  if (!content) {
    notFound();
  }

  const { metadata, default: Content, raw } = content;

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
        description={metadata.description ?? ""}
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
        description={metadata.description ?? ""}
        educationalLevel={tArticles(category)}
        name={metadata.title}
      />
      <LayoutMaterial>
        <LayoutMaterialContent showAskButton>
          <LayoutMaterialHeader
            content={raw}
            description={metadata.description}
            link={{
              href: `/articles/${category}`,
              label: tArticles(category),
            }}
            slug={`/${locale}${FilePath}`}
            title={metadata.title}
          />
          <LayoutMaterialMain>
            {headings.length === 0 && <ComingSoon />}
            {headings.length > 0 && Content}
          </LayoutMaterialMain>
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
            description: metadata.description,
          }}
          references={{
            title: metadata.title,
            data: references,
          }}
          showComments
        />
      </LayoutMaterial>
    </>
  );
}
