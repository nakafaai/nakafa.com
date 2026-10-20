import { PublicPathSchema } from "@nakafa/aksara-contracts/ids";
import { ArticleRouteSlugSchema } from "@nakafa/aksara-contracts/projection/article";
import { getHeadings } from "@repo/contents/toc";
import { loadLocaleMessages } from "@repo/internationalization/src/messages";
import { makeArticleJsonLd } from "@repo/seo/json-ld/article";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { Schema } from "effect";
import { createTranslator } from "use-intl";
import { SheetEntry } from "@/components/ai/sheet/entry";
import { AiMenuItem } from "@/components/ai/sheet/menu";
import { DeferredComments } from "@/components/comments/deferred";
import { ContentDates } from "@/components/content/dates";
import { ContentHeader } from "@/components/content/header";
import { ContentTitle } from "@/components/content/title";
import { BreadcrumbHeaderPath } from "@/components/shared/breadcrumb/header";
import { OpenContent } from "@/components/shared/content/actions";
import { FooterContent } from "@/components/shared/content/footer";
import { LayoutContent } from "@/components/shared/content/layout";
import { LayoutMaterialContent } from "@/components/shared/material/content";
import { LayoutMaterial } from "@/components/shared/material/layout";
import {
  SidebarRightFooter,
  SidebarRightHeader,
  SidebarRightPanel,
  SidebarRightProvider,
} from "@/components/shared/outline/panel";
import { SidebarTree } from "@/components/shared/outline/tree";
import { ComingSoon } from "@/components/shared/upcoming";
import { CommentsButton } from "@/components/sidebar/actions/comments";
import { GithubButton } from "@/components/sidebar/actions/github";
import { ReportButton } from "@/components/sidebar/actions/report";
import { ShareButton } from "@/components/sidebar/actions/share";
import { ContentViewTracker } from "@/components/tracking/tracker";
import { getArticlePublication } from "@/lib/content/article/publication";
import {
  publicContentHeaders,
  readContentCacheTags,
} from "@/lib/content/delivery";
import { getAksaraUrl } from "@/lib/content/repository";
import { getLocaleOrThrow } from "@/lib/i18n/params";
import { getLlmsMarkdownPath } from "@/lib/llms/format";
import { createBreadcrumbItems } from "@/lib/seo/breadcrumbs";
import { getCachedSEOMetadata } from "@/lib/seo/cache";
import { createSeoHead, toRouterHead } from "@/lib/seo/head";
import { getOgUrl } from "@/lib/seo/social";

const ArticleInput = Schema.Struct({
  category: Schema.String,
  locale: Schema.String,
  slug: Schema.String,
});

/**
 * Reads one published article on the server: its metadata for the head, its
 * headings and the source links for the shell. A route that the publication
 * does not hold, or a malformed route, is a 404.
 */
const readArticle = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(ArticleInput))
  .handler(async ({ data }) => {
    const locale = getLocaleOrThrow(data.locale);
    if (
      !(
        Schema.is(ArticleRouteSlugSchema)(data.category) &&
        Schema.is(ArticleRouteSlugSchema)(data.slug)
      )
    ) {
      return { kind: "notFound" as const };
    }
    const publicPath = PublicPathSchema.make(
      `articles/${data.category}/${data.slug}`
    );
    const publication = await getArticlePublication(locale, publicPath);
    if (!publication) {
      return { kind: "notFound" as const };
    }
    const { model, published } = publication;
    const filePath = `/${publicPath}`;
    const [seo, messages] = await Promise.all([
      getCachedSEOMetadata(
        {
          type: "article",
          categoryLabel: model.projection.categoryTitle,
          data: {
            title: model.projection.metadata.title,
            description: model.projection.metadata.description,
            subject: undefined,
          },
        },
        locale
      ),
      loadLocaleMessages(locale),
    ]);
    const tCommon = createTranslator({ locale, messages, namespace: "Common" });
    const categoryLabel = published.categoryTitle;

    return {
      kind: "found" as const,
      cacheTags: readContentCacheTags(["article"]),
      categoryLabel,
      content: published.sourceRevision ? undefined : published.rawMdx,
      contentId: published.contentId,
      copySourceUrl: published.sourceRevision
        ? getLlmsMarkdownPath({ locale, publicPath })
        : null,
      description: seo.description,
      filePath,
      headings: getHeadings(published.rawMdx),
      labels: {
        articles: tCommon("articles"),
        home: tCommon("home"),
        more: tCommon("more"),
        onThisPage: tCommon("on-this-page"),
      },
      locale,
      metadata: published.metadata,
      publicPath,
      sourceUrl: published.sourceRevision
        ? getAksaraUrl({
            path: published.sourcePath,
            revision: published.sourceRevision,
          })
        : null,
      title: seo.title,
      category: data.category,
      breadcrumbs: createBreadcrumbItems(locale, [
        { name: tCommon("home"), path: "" },
        { name: tCommon("articles"), path: "/articles" },
        { name: categoryLabel, path: `/articles/${data.category}` },
      ]),
    };
  });

/** One published article: its shell, its outline and its structured data. */
export const Route = createFileRoute("/$locale/_main/articles/$category/$slug")(
  {
    loader: async ({ params }) => {
      const article = await readArticle({ data: params });
      if (article.kind === "notFound") {
        throw notFound();
      }
      return article;
    },
    head: ({ loaderData }) => {
      if (loaderData === undefined) {
        return {};
      }
      const { filePath, locale, metadata, title, description } = loaderData;
      return toRouterHead(
        createSeoHead({
          canonicalPath: `/${locale}${filePath}`,
          description,
          image: getOgUrl(locale, filePath),
          indexable: true,
          jsonLd: [
            ...makeArticleJsonLd({
              authors: metadata.authors,
              dates: metadata,
              description: metadata.description,
              headline: metadata.title,
              image: getOgUrl(locale, filePath),
              locale,
              path: `/${locale}${filePath}`,
              trail: [
                { name: loaderData.labels.home, path: `/${locale}` },
                {
                  name: loaderData.labels.articles,
                  path: `/${locale}/articles`,
                },
                {
                  name: loaderData.categoryLabel,
                  path: `/${locale}/articles/${loaderData.category}`,
                },
              ],
            }),
          ],
          locale,
          parts: [title],
          type: "article",
        })
      );
    },
    headers: ({ loaderData }) =>
      loaderData === undefined
        ? undefined
        : publicContentHeaders(loaderData.cacheTags),
    component: ArticlePage,
  }
);

function ArticlePage() {
  const article = Route.useLoaderData();
  const { filePath, locale, metadata, headings, labels } = article;
  return (
    <LayoutMaterial>
      <ContentViewTracker
        contentId={article.contentId}
        enabled
        locale={locale}
        publicPath={article.publicPath}
        section="articles"
      >
        <SidebarRightProvider>
          <LayoutMaterialContent>
            <ContentHeader
              breadcrumb={
                <BreadcrumbHeaderPath
                  homeHref="/home"
                  homeLabel={labels.home}
                  items={[
                    { href: "/articles", label: labels.articles },
                    {
                      href: `/articles/${article.category}`,
                      label: article.categoryLabel,
                    },
                  ]}
                  menuLabel={labels.more}
                />
              }
            >
              <OpenContent
                content={article.content}
                copySourceUrl={article.copySourceUrl}
                slug={`/${locale}${filePath}`}
                sourceUrl={article.sourceUrl}
              >
                <AiMenuItem contextTitle={metadata.title} />
              </OpenContent>
            </ContentHeader>
            <ContentTitle
              description={metadata.description}
              title={metadata.title}
            />
            <ContentDates
              {...(metadata.dateModified === undefined
                ? {}
                : { dateModified: metadata.dateModified })}
              datePublished={metadata.datePublished}
            />
            <LayoutContent>
              {headings.length === 0 ? <ComingSoon /> : null}
            </LayoutContent>
            <FooterContent>
              <DeferredComments key={`comments:${filePath}`} slug={filePath} />
            </FooterContent>
            <SheetEntry
              contextTitle={metadata.title}
              key={`nina:${filePath}`}
            />
          </LayoutMaterialContent>
          <SidebarRightPanel
            footer={
              <SidebarRightFooter>
                <CommentsButton />
                <ReportButton />
                {article.sourceUrl ? (
                  <GithubButton githubUrl={article.sourceUrl} />
                ) : null}
                <ShareButton />
              </SidebarRightFooter>
            }
            header={
              <SidebarRightHeader
                description={metadata.description}
                href={filePath}
                title={metadata.title}
              />
            }
          >
            <SidebarTree data={headings} title={labels.onThisPage} />
          </SidebarRightPanel>
        </SidebarRightProvider>
      </ContentViewTracker>
    </LayoutMaterial>
  );
}
