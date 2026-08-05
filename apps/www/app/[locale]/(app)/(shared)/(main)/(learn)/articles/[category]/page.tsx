import {
  type ArticleCategory,
  ArticleCategorySchema,
} from "@nakafa/aksara-contracts/projection/article";
import { BreadcrumbJsonLd } from "@repo/seo/json-ld/breadcrumb";
import { CollectionPageJsonLd } from "@repo/seo/json-ld/collection-page";
import { Option, Schema } from "effect";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import type { Locale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { getArticleCategoryIcon } from "@/components/articles/category";
import { ArticleNext } from "@/components/articles/next";
import { CardArticle } from "@/components/shared/card-article";
import { ContainerList } from "@/components/shared/container-list";
import { FooterContent } from "@/components/shared/footer-content";
import { HeaderContent } from "@/components/shared/header-content";
import { LayoutContent } from "@/components/shared/layout-content";
import { RefContent } from "@/components/shared/ref-content";
import {
  ARTICLE_SOURCE_ROOT,
  getPublishedArticlePage,
  getPublishedCategories,
} from "@/lib/content/article/catalog";
import {
  getArticleNextHref,
  readArticlePageCursor,
} from "@/lib/content/article/query";
import { getLocaleOrThrow } from "@/lib/i18n/params";
import { selectLearningStaticParams } from "@/lib/routing/prerender";
import { getAksaraTreeUrl } from "@/lib/utils/github";
import { getOgUrl, getSocialMetadata } from "@/lib/utils/metadata";
import { createLocalizedAlternates } from "@/lib/utils/seo/alternates";
import { createBreadcrumbItems } from "@/lib/utils/seo/breadcrumbs";

/** Validates one signed article-category route. */
async function getResolvedParams(
  params: PageProps<"/[locale]/articles/[category]">["params"]
) {
  const { locale: rawLocale, category: rawCategory } = await params;
  const locale = getLocaleOrThrow(rawLocale);
  if (!Schema.is(ArticleCategorySchema)(rawCategory)) {
    notFound();
  }
  return { category: rawCategory, locale };
}

/** Builds metadata for one validated article category. */
export async function generateMetadata({
  params,
}: {
  params: PageProps<"/[locale]/articles/[category]">["params"];
}): Promise<Metadata> {
  const { locale, category } = await getResolvedParams(params);
  const [catalog, t] = await Promise.all([
    getPublishedArticlePage({
      category,
      cursor: null,
      expectedManifestHash: null,
      expectedReleaseId: null,
      locale,
    }),
    getTranslations({ locale, namespace: "Articles" }),
  ]);
  const categoryPath = `/articles/${category}`;
  const article = catalog.articles[0];
  if (!article) {
    notFound();
  }
  const title = article.categoryTitle;
  const description = t("description");
  const path = `/${locale}${categoryPath}`;
  const socialMetadata = getSocialMetadata({
    title,
    description,
    locale,
    path,
    image: getOgUrl(locale, categoryPath),
  });

  return {
    title,
    description,
    alternates: createLocalizedAlternates(path),
    ...socialMetadata,
  };
}

/** Generates a bounded category set from the signed article catalog. */
export async function generateStaticParams({
  params,
}: {
  params: { locale: string };
}) {
  const locale = getLocaleOrThrow(params.locale);
  const catalog = await getPublishedCategories({
    cursor: null,
    expectedManifestHash: null,
    expectedReleaseId: null,
    locale,
  });
  return selectLearningStaticParams(
    catalog.categories.map(({ category }) => ({ category })),
    { category: "build-placeholder" }
  );
}

/** Renders one category from the signed article catalog. */
export default function Page({
  params,
  searchParams,
}: PageProps<"/[locale]/articles/[category]">) {
  return (
    <Suspense fallback={null}>
      <PageContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}

/** Reads request-time pagination below the route Suspense boundary. */
async function PageContent({
  params,
  searchParams,
}: PageProps<"/[locale]/articles/[category]">) {
  const [{ category, locale }, query] = await Promise.all([
    getResolvedParams(params),
    searchParams,
  ]);
  const cursor = readArticlePageCursor(query ?? {});
  if (Option.isNone(cursor)) {
    notFound();
  }
  const catalog = await getPublishedArticlePage({
    category,
    ...cursor.value,
    locale,
  });
  const categoryPath = `/articles/${category}`;
  if (catalog.stale) {
    redirect(`/${locale}${categoryPath}`);
  }

  const source = catalog.articles[0];
  if (!source) {
    notFound();
  }
  const sourceUrl = catalog.sourceRevision
    ? getAksaraTreeUrl({
        path: `${ARTICLE_SOURCE_ROOT}/${category}`,
        revision: catalog.sourceRevision,
      })
    : null;
  const nextHref = getArticleNextHref(categoryPath, catalog);

  return (
    <CategoryPage
      articles={catalog.articles}
      category={category}
      categoryPath={categoryPath}
      label={source.categoryTitle}
      locale={locale}
      nextHref={nextHref}
      sourceUrl={sourceUrl}
    />
  );
}

/** Renders the established card list and list-level structured data. */
async function CategoryPage({
  articles,
  category,
  categoryPath,
  label,
  locale,
  nextHref,
  sourceUrl,
}: {
  articles: readonly {
    readonly date: string;
    readonly description: string;
    readonly official: boolean;
    readonly slug: string;
    readonly title: string;
  }[];
  category: ArticleCategory;
  categoryPath: string;
  label: string;
  locale: Locale;
  nextHref: null | string;
  sourceUrl: null | string;
}) {
  const [t, tCommon] = await Promise.all([
    getTranslations({ locale, namespace: "Articles" }),
    getTranslations({ locale, namespace: "Common" }),
  ]);

  return (
    <>
      <BreadcrumbJsonLd
        breadcrumbItems={createBreadcrumbItems(locale, [
          { name: tCommon("home"), path: "" },
          { name: tCommon("articles"), path: "/articles" },
          { name: label, path: categoryPath },
        ])}
      />
      <CollectionPageJsonLd
        description={t("description")}
        items={articles.map((article) => ({
          url: `https://nakafa.com/${locale}${categoryPath}/${article.slug}`,
          name: article.title,
        }))}
        name={label}
        url={`https://nakafa.com/${locale}${categoryPath}`}
      />
      <HeaderContent
        description={t("description")}
        icon={getArticleCategoryIcon(category)}
        title={label}
      />
      <LayoutContent>
        <ContainerList>
          {articles.map((article) => (
            <CardArticle
              article={article}
              category={category}
              key={article.slug}
            />
          ))}
        </ContainerList>
      </LayoutContent>
      {nextHref ? <ArticleNext href={nextHref} /> : null}
      {sourceUrl ? (
        <FooterContent className="mt-0">
          <RefContent githubUrl={sourceUrl} />
        </FooterContent>
      ) : null}
    </>
  );
}
