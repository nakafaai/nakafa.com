import { readNamespaceSegment } from "@repo/contents/route/surface";
import { getHeadings } from "@repo/contents/toc";
import { LocalizedPath } from "@repo/internationalization/src/alternates";
import { loadLocaleMessages } from "@repo/internationalization/src/messages";
import { toCanonicalPath } from "@repo/internationalization/src/rewrite";
import { makeArticleJsonLd } from "@repo/seo/json-ld/article";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { Array as Arr, Effect, Match, Option, Schema } from "effect";
import { createTranslator } from "use-intl/core";
import { SheetEntry } from "@/components/ai/sheet/entry";
import { AiMenuItem } from "@/components/ai/sheet/menu";
import { DeferredComments } from "@/components/comments/deferred";
import { ContentDates } from "@/components/content/dates";
import { ContentHeader } from "@/components/content/header";
import { ContentTitle } from "@/components/content/title";
import {
  BreadcrumbHeaderPath,
  BreadcrumbHeaderSegment,
} from "@/components/shared/breadcrumb/header";
import { OpenContent } from "@/components/shared/content/actions";
import { FooterContent } from "@/components/shared/content/footer";
import { LayoutContent } from "@/components/shared/content/frame";
import { PaginationContent } from "@/components/shared/content/pagination";
import { LayoutMaterialContent } from "@/components/shared/material/content";
import { LayoutMaterial } from "@/components/shared/material/frame";
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
import { PUBLIC_CONTENT_HEADERS } from "@/lib/content/delivery";
import { toMaterialMetadataCopy } from "@/lib/content/material/metadata";
import {
  readMaterialNavigation,
  toMaterialHref,
  toMaterialNavigationPage,
} from "@/lib/content/material/navigation";
import { getMaterialPublication } from "@/lib/content/material/publication";
import { outcome } from "@/lib/content/outcome";
import { getAksaraUrl } from "@/lib/content/repository";
import { getLocaleOrThrow } from "@/lib/i18n/params";
import { getLlmsMarkdownPath } from "@/lib/llms/format";
import { HOME_TARGET } from "@/lib/routing/target";
import { createResolvedRouteAlternates } from "@/lib/seo/alternates";
import { createBreadcrumbItems } from "@/lib/seo/breadcrumbs";
import { createSeoHead, toHeadAlternates, toRouterHead } from "@/lib/seo/head";
import { getOgUrl } from "@/lib/seo/social";
import { serverHandler } from "@/lib/server/fn";

const MaterialInput = Schema.Struct({
  lesson: Schema.Array(Schema.String),
  locale: Schema.String,
  subject: Schema.String,
  topic: Schema.String,
});

/** The curriculum context that a learner chose, which the lesson's links carry. */
const MaterialSearch = Schema.Struct({
  ctx: Schema.optional(Schema.String),
});

/**
 * Reads one signed lesson on the server. A topic row groups curriculum cards
 * and has no page of its own, so a route without a lesson is a 404, as is a
 * lesson that the publication does not hold.
 */
const readMaterial = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(MaterialInput))
  .handler(
    serverHandler(
      Effect.fn("www.materials.material.read")(function* (
        data: typeof MaterialInput.Type
      ) {
        const locale = getLocaleOrThrow(data.locale);
        const namespace = readNamespaceSegment("subject", locale);
        if (!namespace || data.lesson.length === 0) {
          return outcome("NotFound", {});
        }
        const publicPath = Arr.join(
          [namespace, data.subject, data.topic, ...data.lesson],
          "/"
        );
        const publication = yield* getMaterialPublication(locale, publicPath);
        if (Option.isNone(publication) || !publication.value.model.projection) {
          return outcome("NotFound", {});
        }
        const { model, published } = publication.value;
        const route = publication.value.model.projection;
        const canonicalPath = Schema.decodeUnknownOption(LocalizedPath)(
          toCanonicalPath(`/${locale}/${route.publicPath}`)
        );
        if (Option.isNone(canonicalPath)) {
          return outcome("NotFound", {});
        }
        const messages = yield* Effect.promise(() =>
          loadLocaleMessages(locale)
        );
        const tCommon = createTranslator({
          locale,
          messages,
          namespace: "Common",
        });
        const navigation = readMaterialNavigation(
          toMaterialNavigationPage({
            kind: "published",
            route,
            siblings: model.siblings,
          }),
          null
        );

        return outcome("Found", {
          page: {
            alternates: toHeadAlternates(
              createResolvedRouteAlternates(route, model.alternates)
            ),
            breadcrumbs: createBreadcrumbItems(locale, [
              { name: tCommon("home"), path: "" },
            ]),
            canonicalPath: canonicalPath.value,
            content: published.sourceRevision ? undefined : published.rawMdx,
            contentId: route.graph.assetId,
            copySourceUrl: published.sourceRevision
              ? getLlmsMarkdownPath({ locale, publicPath })
              : null,
            headMetadata: toMaterialMetadataCopy({ metadata: route.metadata }),
            body: published.body,
            headings: getHeadings(published.rawMdx),
            labels: {
              home: tCommon("home"),
              more: tCommon("more"),
              onThisPage: tCommon("on-this-page"),
            },
            locale,
            metadata: published.metadata,
            pagination: navigation.pagination,
            route: {
              appLocale: route.appLocale,
              authors: route.metadata.authors,
              contentKey: route.contentKey,
              href: toMaterialHref(route),
              publicPath: route.publicPath,
            },
            sourceUrl: published.sourceRevision
              ? getAksaraUrl({
                  path: published.sourcePath,
                  revision: published.sourceRevision,
                })
              : null,
          },
        });
      })
    )
  );

/** One signed material lesson, reached by its subject, topic and lesson path. */
export const Route = createFileRoute(
  "/$locale/_main/materials/$subject/$topic/$"
)({
  validateSearch: Schema.toStandardSchemaV1(MaterialSearch),
  loader: async ({ params }) => {
    const lesson = Arr.filter(
      (params._splat ?? "").split("/"),
      (segment) => segment !== ""
    );
    const read = await readMaterial({
      data: {
        lesson,
        locale: params.locale,
        subject: params.subject,
        topic: params.topic,
      },
    });
    return Match.value(read).pipe(
      Match.tagsExhaustive({
        Found: ({ page }) => page,
        NotFound: () => {
          throw notFound();
        },
      })
    );
  },
  head: ({ loaderData }) => {
    if (loaderData === undefined) {
      return {};
    }
    const { alternates, canonicalPath, headMetadata, locale, route } =
      loaderData;
    const metadata = loaderData.metadata;
    return toRouterHead(
      createSeoHead({
        alternates,
        canonicalPath,
        description: headMetadata.description,
        image: getOgUrl(route.appLocale, route.publicPath),
        indexable: true,
        jsonLd: [
          makeArticleJsonLd({
            authors: metadata.authors,
            dates: metadata,
            description: headMetadata.description,
            headline: headMetadata.title,
            image: getOgUrl(route.appLocale, route.publicPath),
            locale,
            path: route.href,
            trail: [{ name: loaderData.labels.home, path: `/${locale}` }],
          }),
        ],
        locale,
        parts: [headMetadata.title],
        type: "article",
      })
    );
  },
  headers: ({ loaderData }) =>
    loaderData === undefined ? undefined : PUBLIC_CONTENT_HEADERS,
  component: MaterialPage,
});

function MaterialPage() {
  const page = Route.useLoaderData();
  const { metadata, headings, labels, route } = page;
  return (
    <LayoutMaterial>
      <ContentViewTracker
        contentId={page.contentId}
        enabled
        locale={page.locale}
        publicPath={route.publicPath}
        section="material"
      />
      <SidebarRightProvider>
        <LayoutMaterialContent>
          <ContentHeader
            breadcrumb={
              <BreadcrumbHeaderPath
                home={HOME_TARGET}
                homeLabel={labels.home}
                items={[]}
                menuLabel={labels.more}
              >
                <BreadcrumbHeaderSegment item={{ label: metadata.title }} />
              </BreadcrumbHeaderPath>
            }
          >
            <OpenContent
              content={page.content}
              copySourceUrl={page.copySourceUrl}
              slug={route.href}
              sourceUrl={page.sourceUrl}
            >
              <AiMenuItem contextTitle={metadata.title} />
            </OpenContent>
          </ContentHeader>
          <ContentTitle title={metadata.title} />
          <ContentDates
            {...(metadata.dateModified === undefined
              ? {}
              : { dateModified: metadata.dateModified })}
            datePublished={metadata.datePublished}
          />
          <LayoutContent>
            {headings.length === 0 ? <ComingSoon /> : page.body}
          </LayoutContent>
          <PaginationContent pagination={page.pagination} prefetchNext />
          <FooterContent>
            <DeferredComments slug={route.contentKey} />
          </FooterContent>
          <SheetEntry contextTitle={metadata.title} />
        </LayoutMaterialContent>
        <SidebarRightPanel
          footer={
            <SidebarRightFooter>
              <CommentsButton />
              <ReportButton />
              {page.sourceUrl ? (
                <GithubButton githubUrl={page.sourceUrl} />
              ) : null}
              <ShareButton />
            </SidebarRightFooter>
          }
          header={
            <SidebarRightHeader
              description={metadata.description ?? metadata.subject}
              publicPath={route.publicPath}
              title={metadata.title}
            />
          }
        >
          <SidebarTree data={headings} title={labels.onThisPage} />
        </SidebarRightPanel>
      </SidebarRightProvider>
    </LayoutMaterial>
  );
}
