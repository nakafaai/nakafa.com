import { parseArticleCategory } from "@repo/contents/_lib/articles/category";
import { getSlugPath } from "@repo/contents/_lib/articles/slug";
import { getHeadings } from "@repo/contents/_lib/toc";
import { formatContentDateISO } from "@repo/contents/_shared/date";
import type { ArticleCategory } from "@repo/contents/_types/articles/category";
import { ArticleJsonLd } from "@repo/seo/json-ld/article";
import { BreadcrumbJsonLd } from "@repo/seo/json-ld/breadcrumb";
import { LearningResourceJsonLd } from "@repo/seo/json-ld/learning-resource";
import { Effect } from "effect";
import type { Metadata } from "next";
import { cacheLife } from "next/cache";
import { notFound } from "next/navigation";
import type { Locale } from "next-intl";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { DeferredAiSheetOpen } from "@/components/ai/deferred-sheet-open";
import { DeferredComments } from "@/components/comments/deferred";
import { ComingSoon } from "@/components/shared/coming-soon";
import {
  LayoutMaterial,
  LayoutMaterialContent,
  LayoutMaterialFooter,
  LayoutMaterialHeader,
  LayoutMaterialMain,
  LayoutMaterialToc,
} from "@/components/shared/layout-material";
import { getLocaleOrThrow } from "@/lib/i18n/params";
import { getGithubUrl } from "@/lib/utils/github";
import { getOgUrl } from "@/lib/utils/metadata";
import {
  fetchArticleContext,
  fetchArticleMetadataContext,
} from "@/lib/utils/pages/article";
import { generateSEOMetadata } from "@/lib/utils/seo/generator";
import type { SEOContext } from "@/lib/utils/seo/types";
import { getStaticParams } from "@/lib/utils/system";

async function getResolvedParams(
  params: PageProps<"/[locale]/articles/[category]/[slug]">["params"]
) {
  const { locale: rawLocale, category: rawCategory, slug } = await params;
  const locale = getLocaleOrThrow(rawLocale);
  const category = parseArticleCategory(rawCategory);

  if (!category) {
    notFound();
  }

  return { category, locale, slug };
}

export async function generateMetadata({
  params,
}: {
  params: PageProps<"/[locale]/articles/[category]/[slug]">["params"];
}): Promise<Metadata> {
  const { locale, category, slug } = await getResolvedParams(params);
  const t = await getTranslations({ locale, namespace: "Articles" });

  const { content, filePath } = await getArticleMetadataData({
    locale,
    category,
    slug,
  });

  const path = `/${locale}${filePath}`;
  const alternates = {
    canonical: path,
  };
  const image = {
    url: getOgUrl(locale, filePath),
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

  // Evidence: Use ICU-based SEO generator for type-safe, locale-aware metadata
  // Source: https://developers.google.com/search/docs/appearance/title-link
  const seoContext: SEOContext = {
    type: "article",
    category,
    data: {
      title: content?.metadata.title,
      description: content?.metadata.description,
      subject: undefined,
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

async function getArticleMetadataData({
  locale,
  category,
  slug,
}: {
  locale: Locale;
  category: ArticleCategory;
  slug: string;
}) {
  "use cache";

  cacheLife("max");

  return Effect.runPromise(
    Effect.match(fetchArticleMetadataContext({ locale, category, slug }), {
      onFailure: () => ({
        content: null,
        filePath: getSlugPath(category, slug),
      }),
      onSuccess: ({ content, FilePath }) => ({
        content,
        filePath: FilePath,
      }),
    })
  );
}

// Generate bottom-up static params
export function generateStaticParams() {
  return getStaticParams({
    basePath: "articles",
    paramNames: ["category", "slug"],
  });
}

export default async function Page({
  params,
}: PageProps<"/[locale]/articles/[category]/[slug]">) {
  const { locale, category, slug } = await getResolvedParams(params);
  const filePath = getSlugPath(category, slug);

  return (
    <CachedArticleShell
      category={category}
      footer={<DeferredComments key={`comments:${filePath}`} slug={filePath} />}
      locale={locale}
      slug={slug}
      toolbar={
        <DeferredAiSheetOpen
          audio={{
            locale,
            slug: filePath,
            contentType: "article",
          }}
          key={`audio:${filePath}`}
        />
      }
    />
  );
}

async function CachedArticleShell({
  locale,
  category,
  slug,
  footer,
  toolbar,
}: {
  locale: Locale;
  category: ArticleCategory;
  slug: string;
  footer: ReactNode;
  toolbar: ReactNode;
}) {
  "use cache";

  cacheLife("max");

  const [tCommon, tArticles] = await Promise.all([
    getTranslations("Common"),
    getTranslations("Articles"),
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
    return (
      <LayoutMaterial>
        <LayoutMaterialContent>
          <LayoutMaterialMain className="py-24">
            <ComingSoon />
          </LayoutMaterialMain>
        </LayoutMaterialContent>
      </LayoutMaterial>
    );
  }

  const { metadata, default: Content, raw } = content;
  const publishedAt = formatContentDateISO(metadata.date) ?? metadata.date;

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
        datePublished={publishedAt}
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
        datePublished={publishedAt}
        description={metadata.description ?? ""}
        educationalLevel={tArticles(category)}
        name={metadata.title}
      />
      <LayoutMaterial>
        <LayoutMaterialContent>
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
            {headings.length > 0 && Content ? <Content /> : null}
          </LayoutMaterialMain>
          <LayoutMaterialFooter>{footer}</LayoutMaterialFooter>
          {toolbar}
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
