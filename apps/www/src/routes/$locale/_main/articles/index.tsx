import { BookOpen02Icon } from "@hugeicons/core-free-icons";
import { loadLocaleMessages } from "@repo/internationalization/src/messages";
import { makeBreadcrumbNodes } from "@repo/seo/json-ld/node";
import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { Array as Arr, Effect, Match, Option, Schema } from "effect";
import { createTranslator } from "use-intl/core";
import { getArticleCategoryIcons } from "@/components/articles/category";
import { ArticleNext } from "@/components/articles/next";
import { FooterContent } from "@/components/shared/content/footer";
import { LayoutContent } from "@/components/shared/content/frame";
import { HeaderContent } from "@/components/shared/content/header";
import { RefContent } from "@/components/shared/content/references";
import { SubjectItem } from "@/components/shared/subject/item";
import { SubjectList } from "@/components/shared/subject/list";
import {
  ARTICLE_SOURCE_ROOT,
  readPublishedCategories,
} from "@/lib/content/article/catalog";
import {
  ArticlePageSearchSchema,
  getArticleNextSearch,
  readArticlePageCursor,
} from "@/lib/content/article/query";
import { PUBLIC_CONTENT_HEADERS } from "@/lib/content/delivery";
import { outcome } from "@/lib/content/outcome";
import { getAksaraTreeUrl } from "@/lib/content/repository";
import { getLocaleOrThrow } from "@/lib/i18n/params";
import { articleCategoryTarget } from "@/lib/routing/target";
import { createBreadcrumbItems } from "@/lib/seo/breadcrumbs";
import { createSeoHead, toRouterHead } from "@/lib/seo/head";
import { getOgUrl } from "@/lib/seo/social";
import { serverHandler } from "@/lib/server/fn";
import { readStaticData } from "@/lib/static/data";

/**
 * Reads the article categories of one locale on the server. The decision to
 * answer 404 or redirect is returned, and the route loader acts on it, so the
 * status is set before the stream starts.
 */
const ArticleIndexInput = Schema.Struct({
  ...ArticlePageSearchSchema.fields,
  locale: Schema.String,
});

const readArticleIndex = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(ArticleIndexInput))
  .handler(
    serverHandler(
      Effect.fn("www.articles.index.read")(function* (
        data: typeof ArticleIndexInput.Type
      ) {
        const locale = getLocaleOrThrow(data.locale);
        const cursor = readArticlePageCursor(data);
        if (Option.isNone(cursor)) {
          return outcome("NotFound", {});
        }
        const catalog = yield* readPublishedCategories({
          ...cursor.value,
          locale,
        });
        if (catalog.stale) {
          return outcome("Redirect", {});
        }
        const messages = yield* Effect.promise(() =>
          loadLocaleMessages(locale)
        );
        const tCommon = createTranslator({
          locale,
          messages,
          namespace: "Common",
        });
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

        return outcome("Found", {
          page: {
            breadcrumbs,
            categories: catalog.categories,
            description: tArticles("description"),
            locale,
            nextSearch: Option.getOrNull(getArticleNextSearch(catalog)),
            sourceUrl,
            title: tCommon("articles"),
          },
        });
      })
    )
  );

/** The article categories of one locale, with the cursor the reader asks for. */
export const Route = createFileRoute("/$locale/_main/articles/")({
  validateSearch: Schema.toStandardSchemaV1(ArticlePageSearchSchema),
  loaderDeps: ({ search }) => ({
    cursor: search.cursor,
    manifest: search.manifest,
    release: search.release,
  }),
  loader: async ({ params, deps }) => {
    const read = await readStaticData(readArticleIndex, {
      ...deps,
      locale: params.locale,
    });
    return Match.value(read).pipe(
      Match.tagsExhaustive({
        Found: ({ page }) => page,
        NotFound: () => {
          throw notFound();
        },
        Redirect: () => {
          throw redirect({
            params: { locale: params.locale },
            statusCode: 307,
            to: "/$locale/articles",
          });
        },
      })
    );
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
    loaderData === undefined ? undefined : PUBLIC_CONTENT_HEADERS,
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
                icon={icon}
                key={route}
                label={title}
                target={articleCategoryTarget(route)}
              />
            )
          )}
        </SubjectList>
      </LayoutContent>
      {page.nextSearch ? <ArticleNext search={page.nextSearch} /> : null}
      {page.sourceUrl ? (
        <FooterContent className="mt-0">
          <RefContent githubUrl={page.sourceUrl} />
        </FooterContent>
      ) : null}
    </>
  );
}
