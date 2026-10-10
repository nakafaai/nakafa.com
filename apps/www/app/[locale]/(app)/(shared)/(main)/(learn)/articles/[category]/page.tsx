import { AppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import {
  type ArticleCategory,
  ArticleRouteSlugSchema,
} from "@nakafa/aksara-contracts/projection/article";
import { COMPANY_IDENTITY } from "@repo/seo/company";
import { BreadcrumbJsonLd } from "@repo/seo/json-ld/breadcrumb";
import { CollectionPageJsonLd } from "@repo/seo/json-ld/collection-page";
import { Array as Arr, Effect, Option, Schema } from "effect";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import type { Locale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { getArticleCategoryIcon } from "@/components/articles/category";
import { ArticleNext } from "@/components/articles/next";
import { CardArticle } from "@/components/shared/card/article";
import { ContainerList } from "@/components/shared/card/list";
import { FooterContent } from "@/components/shared/content/footer";
import { HeaderContent } from "@/components/shared/content/header";
import { LayoutContent } from "@/components/shared/content/layout";
import { RefContent } from "@/components/shared/content/references";
import {
  ARTICLE_SOURCE_ROOT,
  type PublishedArticleSummary,
} from "@/lib/content/article/catalog";
import {
  getPublishedArticleCategory,
  getPublishedCategoryAlternates,
  getPublishedCategoryPage,
} from "@/lib/content/article/category";
import { readPublishedArticlePrerenderRoute } from "@/lib/content/article/prerender";
import {
  getArticleNextHref,
  readArticlePageCursor,
  shouldResetArticlePublicationCursor,
} from "@/lib/content/article/query";
import { hasPreviewConfig } from "@/lib/content/preview/config";
import { readArticlePreviewStaticParams } from "@/lib/content/preview/route";
import { getAksaraTreeUrl } from "@/lib/content/repository";
import { getLocaleOrThrow, type LocaleRouteParams } from "@/lib/i18n/params";
import { createResolvedRouteAlternates } from "@/lib/seo/alternates";
import { createBreadcrumbItems } from "@/lib/seo/breadcrumbs";
import { getOgUrl, getSocialMetadata } from "@/lib/seo/social";

/** Validates one signed article-category route. */
async function getResolvedParams(
  params: PageProps<"/[locale]/articles/[category]">["params"]
) {
  const { locale: rawLocale, category: rawCategory } = await params;
  const locale = getLocaleOrThrow(rawLocale);
  if (!Schema.is(ArticleRouteSlugSchema)(rawCategory)) {
    notFound();
  }
  const resolved = await getPublishedArticleCategory(rawCategory, locale);
  if (!resolved) {
    notFound();
  }
  return { locale, model: resolved };
}

/** Builds metadata for one validated article category. */
export async function generateMetadata({
  params,
}: {
  params: PageProps<"/[locale]/articles/[category]">["params"];
}): Promise<Metadata> {
  const { locale, model } = await getResolvedParams(params);
  const [alternates, catalog, t] = await Promise.all([
    getPublishedCategoryAlternates(model),
    getPublishedCategoryPage(model, {
      cursor: null,
      expectedManifestHash: null,
      expectedReleaseId: null,
    }),
    getTranslations({ locale, namespace: "Articles" }),
  ]);
  if (catalog.articles.length === 0) {
    notFound();
  }
  const categoryPath = `/articles/${model.route}`;
  const title = model.title;
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
    alternates: createResolvedRouteAlternates(
      {
        appLocale: AppLocaleSchema.make(locale),
        publicPath: `articles/${model.route}`,
      },
      alternates
    ),
    ...socialMetadata,
  };
}

/** Supplies one real article category per locale for Cache Components. */
export async function generateStaticParams({
  params,
}: {
  params: LocaleRouteParams;
}) {
  const locale = getLocaleOrThrow(params.locale);
  if (hasPreviewConfig()) {
    const preview = await readArticlePreviewStaticParams(
      AppLocaleSchema.make(locale)
    );
    return Arr.map(preview, ({ category }) => ({ category }));
  }
  const route = await Effect.runPromise(
    readPublishedArticlePrerenderRoute(locale)
  );
  return [{ category: route.category }];
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
  const [{ locale, model }, query] = await Promise.all([
    getResolvedParams(params),
    searchParams,
  ]);
  const cursor = readArticlePageCursor(query ?? {});
  if (Option.isNone(cursor)) {
    notFound();
  }
  const categoryPath = `/articles/${model.route}`;
  if (shouldResetArticlePublicationCursor(cursor.value)) {
    redirect(`/${locale}${categoryPath}`);
  }
  const catalog = await getPublishedCategoryPage(model, cursor.value);
  if (catalog.stale) {
    redirect(`/${locale}${categoryPath}`);
  }

  if (catalog.articles.length === 0) {
    notFound();
  }
  const sourceUrl = catalog.sourceRevision
    ? getAksaraTreeUrl({
        path: `${ARTICLE_SOURCE_ROOT}/${model.category}`,
        revision: catalog.sourceRevision,
      })
    : null;
  const nextHref = getArticleNextHref(categoryPath, catalog);

  return (
    <CategoryPage
      articles={catalog.articles}
      category={model.category}
      categoryPath={categoryPath}
      label={model.title}
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
  articles: readonly PublishedArticleSummary[];
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
        items={Arr.map(articles, (article) => ({
          url: `${COMPANY_IDENTITY.url}/${locale}/${article.publicPath}`,
          name: article.title,
        }))}
        name={label}
        url={`${COMPANY_IDENTITY.url}/${locale}${categoryPath}`}
      />
      <HeaderContent
        description={t("description")}
        icon={getArticleCategoryIcon(category)}
        title={label}
      />
      <LayoutContent>
        <ContainerList>
          {Arr.map(articles, (article) => (
            <CardArticle article={article} key={article.publicPath} />
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
