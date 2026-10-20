import { BookOpen02Icon } from "@hugeicons/core-free-icons";
import { loadLocaleMessages } from "@repo/internationalization/src/messages";
import { makeBreadcrumbNodes } from "@repo/seo/json-ld/node";
import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { Array as Arr, Option, Schema } from "effect";
import { createTranslator } from "use-intl";
import { getArticleCategoryIcons } from "@/components/articles/category";
import { ArticleNext } from "@/components/articles/next";
import { FooterContent } from "@/components/shared/content/footer";
import { HeaderContent } from "@/components/shared/content/header";
import { LayoutContent } from "@/components/shared/content/layout";
import { RefContent } from "@/components/shared/content/references";
import { SubjectItem } from "@/components/shared/subject/item";
import { SubjectList } from "@/components/shared/subject/list";
import {
  ARTICLE_SOURCE_ROOT,
  getPublishedCategories,
} from "@/lib/content/article/catalog";
import {
  getArticleNextHref,
  readArticlePageCursor,
} from "@/lib/content/article/query";
import {
  publicContentHeaders,
  readContentCacheTags,
} from "@/lib/content/delivery";
import { getAksaraTreeUrl } from "@/lib/content/repository";
import { getLocaleOrThrow } from "@/lib/i18n/params";
import { createBreadcrumbItems } from "@/lib/seo/breadcrumbs";
import { createSeoHead, toRouterHead } from "@/lib/seo/head";
import { getOgUrl } from "@/lib/seo/social";

const ArticleIndexSearch = Schema.Struct({
  cursor: Schema.optional(Schema.String),
  manifest: Schema.optional(Schema.String),
  release: Schema.optional(Schema.String),
});

/**
 * Reads the article categories of one locale on the server. The decision to
 * answer 404 or redirect is returned, and the route loader acts on it, so the
 * status is set before the stream starts.
 */
const readArticleIndex = createServerFn({ method: "GET" })
  .validator(
    Schema.toStandardSchemaV1(
      Schema.Struct({ ...ArticleIndexSearch.fields, locale: Schema.String })
    )
  )
  .handler(async ({ data }) => {
    const locale = getLocaleOrThrow(data.locale);
    const cursor = readArticlePageCursor(data);
    if (Option.isNone(cursor)) {
      return { kind: "notFound" as const };
    }
    const catalog = await getPublishedCategories({ ...cursor.value, locale });
    if (catalog.stale) {
      return { kind: "redirect" as const };
    }
    const messages = await loadLocaleMessages(locale);
    const tCommon = createTranslator({ locale, messages, namespace: "Common" });
    const tArticles = createTranslator({
      locale,
      messages,
      namespace: "Articles",
    });
    const sourceUrl = catalog.sourceRevision
      ? getAksaraTreeUrl({
          path: ARTICLE_SOURCE_ROOT,
          revision: catalog.sourceRevision,
        })
      : null;
    const breadcrumbs = createBreadcrumbItems(locale, [
      { name: tCommon("home"), path: "" },
      { name: tCommon("articles"), path: "/articles" },
    ]);

    return {
      kind: "found" as const,
      breadcrumbs,
      cacheTags: readContentCacheTags(["article"]),
      categories: catalog.categories,
      description: tArticles("description"),
      locale,
      nextHref: getArticleNextHref("/articles", catalog),
      sourceUrl,
      title: tCommon("articles"),
    };
  });

/** The article categories of one locale, with the cursor the reader asks for. */
export const Route = createFileRoute("/$locale/_main/articles/")({
  validateSearch: Schema.toStandardSchemaV1(ArticleIndexSearch),
  loaderDeps: ({ search }) => ({
    cursor: search.cursor,
    manifest: search.manifest,
    release: search.release,
  }),
  loader: async ({ params, deps }) => {
    const page = await readArticleIndex({
      data: { ...deps, locale: params.locale },
    });
    if (page.kind === "notFound") {
      throw notFound();
    }
    if (page.kind === "redirect") {
      throw redirect({
        params: { locale: params.locale },
        statusCode: 307,
        to: "/$locale/articles",
      });
    }
    return page;
  },
  head: ({ loaderData }) => {
    if (loaderData === undefined) {
      return {};
    }
    return toRouterHead(
      createSeoHead({
        canonicalPath: `/${loaderData.locale}/articles`,
        description: loaderData.description,
        image: getOgUrl(loaderData.locale, "/articles"),
        indexable: true,
        jsonLd: makeBreadcrumbNodes(loaderData.breadcrumbs),
        locale: loaderData.locale,
        parts: [loaderData.title],
        type: "website",
      })
    );
  },
  headers: ({ loaderData }) =>
    loaderData === undefined
      ? undefined
      : publicContentHeaders(loaderData.cacheTags),
  component: ArticleIndexPage,
});

function ArticleIndexPage() {
  const page = Route.useLoaderData();
  return (
    <>
      <HeaderContent
        description={page.description}
        icon={BookOpen02Icon}
        title={page.title}
      />
      <LayoutContent>
        <SubjectList>
          {Arr.zipWith(
            page.categories,
            getArticleCategoryIcons(page.categories),
            ({ route, title }, icon) => (
              <SubjectItem
                href={`/articles/${route}`}
                icon={icon}
                key={route}
                label={title}
              />
            )
          )}
        </SubjectList>
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
