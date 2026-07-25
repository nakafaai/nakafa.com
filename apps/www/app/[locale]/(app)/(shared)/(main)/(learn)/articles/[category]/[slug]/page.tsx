import { PublicPathSchema } from "@nakafa/aksara-contracts/ids";
import {
  ArticleCategorySchema,
  ArticleSlugSchema,
} from "@nakafa/aksara-contracts/projection/article";
import { ArticleJsonLd } from "@repo/seo/json-ld/article";
import { BreadcrumbJsonLd } from "@repo/seo/json-ld/breadcrumb";
import { LearningResourceJsonLd } from "@repo/seo/json-ld/learning-resource";
import { Schema } from "effect";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArticleShell } from "@/app/[locale]/(app)/(shared)/(main)/(learn)/articles/[category]/[slug]/shell";
import {
  readArticleMetadata,
  readArticlePage,
} from "@/app/[locale]/(app)/(shared)/(main)/(learn)/articles/[category]/[slug]/source";
import { DeferredAiSheetOpen } from "@/components/ai/deferred-sheet-open";
import { DeferredComments } from "@/components/comments/deferred";
import {
  getPublishedArticlePage,
  getPublishedCategories,
} from "@/lib/content/article/catalog";
import { getLocaleOrThrow } from "@/lib/i18n/params";
import { selectLearningStaticParams } from "@/lib/routing/prerender";
import { getOgUrl, getSocialMetadata } from "@/lib/utils/metadata";
import { createLocalizedAlternates } from "@/lib/utils/seo/alternates";
import { createBreadcrumbItems } from "@/lib/utils/seo/breadcrumbs";
import { generateSEOMetadata } from "@/lib/utils/seo/generator";
import type { SEOContext } from "@/lib/utils/seo/types";
import { getStaticParams } from "@/lib/utils/system";

type ArrayItem<T> = T extends readonly (infer Item)[] ? Item : T;
type ArticleJsonLdAuthor = ArrayItem<
  Parameters<typeof ArticleJsonLd>[0]["author"]
>;

/** Validates localized article route params before metadata and rendering touch content modules. */
async function getResolvedParams(
  params: PageProps<"/[locale]/articles/[category]/[slug]">["params"]
) {
  const { locale: rawLocale, category: rawCategory, slug } = await params;
  const locale = getLocaleOrThrow(rawLocale);
  if (
    !(
      Schema.is(ArticleCategorySchema)(rawCategory) &&
      Schema.is(ArticleSlugSchema)(slug)
    )
  ) {
    notFound();
  }
  const publicPath = PublicPathSchema.make(`articles/${rawCategory}/${slug}`);
  return { category: rawCategory, locale, publicPath, slug };
}

/** Builds article metadata from the projected article route and runtime content row. */
export async function generateMetadata({
  params,
}: {
  params: PageProps<"/[locale]/articles/[category]/[slug]">["params"];
}): Promise<Metadata> {
  const { locale, category, publicPath, slug } =
    await getResolvedParams(params);
  const article = await readArticleMetadata({
    locale,
    category,
    publicPath,
    slug,
  });
  const metadata = article.metadata;
  const filePath = `/${publicPath}`;
  const path = `/${locale}${filePath}`;
  const categoryLabel = article.categoryTitle;
  const alternates = createLocalizedAlternates(path, {
    types: {
      "text/markdown": `${path}.md`,
    },
  });
  // Evidence: Use ICU-based SEO generator for type-safe, locale-aware metadata
  // Source: https://developers.google.com/search/docs/appearance/title-link
  const seoContext: SEOContext = {
    type: "article",
    categoryLabel,
    data: {
      title: metadata.title,
      description: metadata.description,
      subject: undefined,
    },
  };

  const { title, description, keywords } = await generateSEOMetadata(
    seoContext,
    locale
  );
  const socialMetadata = getSocialMetadata({
    title,
    description,
    locale,
    path,
    image: getOgUrl(locale, filePath),
    type: "article",
  });

  return {
    title: { absolute: title },
    description,
    alternates,
    authors: metadata.authors.map(({ name }) => ({ name })),
    category: categoryLabel,
    keywords,
    ...socialMetadata,
  };
}

/** Prebuilds a bounded article page set from its active owner. */
export async function generateStaticParams({
  params,
}: {
  params: { locale: string };
}) {
  const locale = getLocaleOrThrow(params.locale);
  const categories = await getPublishedCategories({
    cursor: null,
    expectedManifestHash: null,
    expectedReleaseId: null,
    locale,
  });
  if (categories.managed) {
    const pages = await Promise.all(
      categories.categories.map(({ category }) =>
        getPublishedArticlePage({
          category,
          cursor: null,
          expectedManifestHash: null,
          expectedReleaseId: null,
          locale,
        })
      )
    );
    const articles = pages.flatMap((page) =>
      page.articles.map((article) => ({
        category: article.category,
        slug: article.slug,
      }))
    );
    return selectLearningStaticParams(articles, {
      category: "build-placeholder",
      slug: "build-placeholder",
    });
  }
  return getStaticParams({
    basePath: "articles",
    locale,
    paramNames: ["category", "slug"],
  });
}

/** Renders an article after Convex confirms the published route exists. */
export default async function Page({
  params,
}: PageProps<"/[locale]/articles/[category]/[slug]">) {
  const { locale, category, publicPath, slug } =
    await getResolvedParams(params);
  const article = await readArticlePage({
    category,
    locale,
    publicPath,
    slug,
  });
  const filePath = `/${publicPath}`;
  const contentMetadata = article.metadata;

  const tCommon = await getTranslations("Common");
  const categoryLabel = article.categoryTitle;
  const publishedAt = new Date(
    `${contentMetadata.date}T00:00:00.000Z`
  ).toISOString();
  const authorJsonLd: ArticleJsonLdAuthor[] = contentMetadata.authors.map(
    (author) => ({
      "@type": "Person",
      name: author.name,
      url: `https://nakafa.com/${locale}/contributor`,
    })
  );

  return (
    <>
      <BreadcrumbJsonLd
        breadcrumbItems={createBreadcrumbItems(locale, [
          { name: tCommon("home"), path: "" },
          { name: tCommon("articles"), path: "/articles" },
          { name: categoryLabel, path: `/articles/${category}` },
          { name: contentMetadata.title, path: filePath },
        ])}
      />
      <ArticleJsonLd
        author={authorJsonLd}
        datePublished={publishedAt}
        description={contentMetadata.description ?? ""}
        headline={contentMetadata.title}
        image={getOgUrl(locale, filePath)}
        url={`/${locale}${filePath}`}
      />
      <LearningResourceJsonLd
        author={authorJsonLd}
        datePublished={publishedAt}
        description={contentMetadata.description ?? ""}
        educationalLevel={categoryLabel}
        name={contentMetadata.title}
      />
      <ArticleShell
        category={category}
        categoryLabel={categoryLabel}
        content={article}
        filePath={filePath}
        footer={
          <DeferredComments key={`comments:${filePath}`} slug={filePath} />
        }
        locale={locale}
        toolbar={
          <DeferredAiSheetOpen
            audio={{
              locale,
              slug: filePath,
              contentType: "article",
            }}
            contextTitle={contentMetadata.title}
            key={`audio:${filePath}`}
          />
        }
      >
        {article.children}
      </ArticleShell>
    </>
  );
}
