import { ArticleRouteSlugSchema } from "@nakafa/aksara-contracts/projection/article";
import { loadLocaleMessages } from "@repo/internationalization/src/messages";
import { COMPANY_IDENTITY } from "@repo/seo/company";
import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { Array as Arr, Option, Schema } from "effect";
import { createTranslator } from "use-intl";
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
  type ArticlePageCursor,
} from "@/lib/content/article/catalog";
import {
  getPublishedArticleCategory,
  getPublishedCategoryPage,
} from "@/lib/content/article/category";
import {
  getArticleNextHref,
  readArticlePageCursor,
  shouldResetArticlePublicationCursor,
} from "@/lib/content/article/query";
import {
  publicContentHeaders,
  readContentCacheTags,
} from "@/lib/content/delivery";
import { getAksaraTreeUrl } from "@/lib/content/repository";
import { getLocaleOrThrow } from "@/lib/i18n/params";
import { createBreadcrumbItems } from "@/lib/seo/breadcrumbs";
import { createSeoHead, toRouterHead } from "@/lib/seo/head";
import { makeCollectionPageNode, readBreadcrumbNodes } from "@/lib/seo/json-ld";
import { getOgUrl } from "@/lib/seo/social";

const CategorySearch = Schema.Struct({
  cursor: Schema.optional(Schema.String),
  manifest: Schema.optional(Schema.String),
  release: Schema.optional(Schema.String),
});

/** The first page of a category, which the reader needs before it can answer. */
const FIRST_PAGE: ArticlePageCursor = {
  cursor: null,
  expectedManifestHash: null,
  expectedReleaseId: null,
};

/**
 * Reads one article category and its requested page on the server. A missing
 * category, an empty one or a malformed cursor is a 404; a stale or reset cursor
 * is a redirect to the category's first page.
 */
const readArticleCategory = createServerFn({ method: "GET" })
  .validator(
    Schema.toStandardSchemaV1(
      Schema.Struct({
        ...CategorySearch.fields,
        category: Schema.String,
        locale: Schema.String,
      })
    )
  )
  .handler(async ({ data }) => {
    const locale = getLocaleOrThrow(data.locale);
    if (!Schema.is(ArticleRouteSlugSchema)(data.category)) {
      return { kind: "notFound" as const };
    }
    const model = await getPublishedArticleCategory(data.category, locale);
    if (model === null) {
      return { kind: "notFound" as const };
    }
    const first = await getPublishedCategoryPage(model, FIRST_PAGE);
    if (first.articles.length === 0) {
      return { kind: "notFound" as const };
    }
    const cursor = readArticlePageCursor(data);
    if (Option.isNone(cursor)) {
      return { kind: "notFound" as const };
    }
    if (shouldResetArticlePublicationCursor(cursor.value)) {
      return { kind: "redirect" as const };
    }
    const catalog = await getPublishedCategoryPage(model, cursor.value);
    if (catalog.stale) {
      return { kind: "redirect" as const };
    }
    if (catalog.articles.length === 0) {
      return { kind: "notFound" as const };
    }
    const messages = await loadLocaleMessages(locale);
    const tCommon = createTranslator({ locale, messages, namespace: "Common" });
    const tArticles = createTranslator({
      locale,
      messages,
      namespace: "Articles",
    });
    const categoryPath = `/articles/${model.route}`;
    const breadcrumbs = createBreadcrumbItems(locale, [
      { name: tCommon("home"), path: "" },
      { name: tCommon("articles"), path: "/articles" },
      { name: model.title, path: categoryPath },
    ]);

    return {
      kind: "found" as const,
      articles: catalog.articles,
      breadcrumbs,
      cacheTags: readContentCacheTags(["article"]),
      category: model.category,
      categoryPath,
      description: tArticles("description"),
      label: model.title,
      locale,
      nextHref: getArticleNextHref(categoryPath, catalog),
      sourceUrl: catalog.sourceRevision
        ? getAksaraTreeUrl({
            path: `${ARTICLE_SOURCE_ROOT}/${model.category}`,
            revision: catalog.sourceRevision,
          })
        : null,
    };
  });

/** One article category: its cards, its pages and its collection data. */
export const Route = createFileRoute("/$locale/_main/articles/$category/")({
  validateSearch: Schema.toStandardSchemaV1(CategorySearch),
  loaderDeps: ({ search }) => ({
    cursor: search.cursor,
    manifest: search.manifest,
    release: search.release,
  }),
  loader: async ({ params, deps }) => {
    const page = await readArticleCategory({
      data: { ...deps, category: params.category, locale: params.locale },
    });
    if (page.kind === "notFound") {
      throw notFound();
    }
    if (page.kind === "redirect") {
      throw redirect({
        params: { category: params.category, locale: params.locale },
        statusCode: 307,
        to: "/$locale/articles/$category",
      });
    }
    return page;
  },
  head: ({ loaderData }) => {
    if (loaderData === undefined) {
      return {};
    }
    const { articles, breadcrumbs, categoryPath, description, label, locale } =
      loaderData;
    const url = `${COMPANY_IDENTITY.url}/${locale}${categoryPath}`;
    return toRouterHead(
      createSeoHead({
        canonicalPath: `/${locale}${categoryPath}`,
        description,
        image: getOgUrl(locale, categoryPath),
        indexable: true,
        jsonLd: [
          ...readBreadcrumbNodes(breadcrumbs),
          makeCollectionPageNode({
            description,
            items: Arr.map(articles, (article) => ({
              name: article.title,
              url: `${COMPANY_IDENTITY.url}/${locale}/${article.publicPath}`,
            })),
            name: label,
            url,
          }),
        ],
        locale,
        parts: [label],
        type: "website",
      })
    );
  },
  headers: ({ loaderData }) =>
    loaderData === undefined
      ? undefined
      : publicContentHeaders(loaderData.cacheTags),
  component: ArticleCategoryPage,
});

function ArticleCategoryPage() {
  const page = Route.useLoaderData();
  return (
    <>
      <HeaderContent
        description={page.description}
        icon={getArticleCategoryIcon(page.category)}
        title={page.label}
      />
      <LayoutContent>
        <ContainerList>
          {Arr.map(page.articles, (article) => (
            <CardArticle article={article} key={article.publicPath} />
          ))}
        </ContainerList>
      </LayoutContent>
      {page.nextHref ? <ArticleNext href={page.nextHref} /> : null}
      {page.sourceUrl ? (
        <FooterContent className="mt-0">
          <RefContent githubUrl={page.sourceUrl} />
        </FooterContent>
      ) : null}
    </>
  );
}
