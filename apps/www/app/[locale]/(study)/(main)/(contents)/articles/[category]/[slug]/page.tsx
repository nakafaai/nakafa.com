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

  const result = await Effect.runPromise(
    Effect.catchAll(
      fetchArticleMetadataContext({ locale, category, slug }),
      () =>
        Effect.succeed({
          content: null,
          FilePath: `/${category}/${slug}`,
        })
    )
  );

  const { content, FilePath } = result;

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

  if (!content) {
    return {
      title: t(category),
      alternates,
      openGraph,
      twitter,
    };
  }

  const { metadata } = content;

  return {
    title: {
      absolute: `${metadata.title} - ${t(category)}`,
    },
    description: metadata.description,
    alternates,
    authors: metadata.authors,
    category: t(category),
    keywords: metadata.title
      .split(" ")
      .concat(metadata.description?.split(" ") ?? [])
      .filter((keyword: string) => keyword.length > 0),
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

  const result = await Effect.runPromise(
    Effect.catchAll(fetchArticleContext({ locale, category, slug }), () =>
      Effect.succeed({ content: null, references: null })
    )
  );

  const { content, references } = result;

  if (!content) {
    notFound();
  }

  const FilePath = `/${category}/${slug}`;
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
        description={metadata.description ?? ""}
        locale={locale}
        name={metadata.title}
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
