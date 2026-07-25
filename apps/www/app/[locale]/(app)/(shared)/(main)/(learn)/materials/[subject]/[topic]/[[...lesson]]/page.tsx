import type { LearningContextInput } from "@repo/backend/convex/contents/context";
import { getHeadings } from "@repo/contents/_lib/toc";
import { formatContentDateISO } from "@repo/contents/_shared/date";
import { toLocalizedContentHref } from "@repo/contents/_types/route/content";
import type { MaterialContextIdentity } from "@repo/contents/_types/route/material/reference";
import type { PublicContentRoute } from "@repo/contents/_types/route/schema";
import { ArticleJsonLd } from "@repo/seo/json-ld/article";
import { BreadcrumbJsonLd } from "@repo/seo/json-ld/breadcrumb";
import { LearningResourceJsonLd } from "@repo/seo/json-ld/learning-resource";
import { Option } from "effect";
import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import {
  getProjectedMaterialIcon,
  listMaterialStaticParams,
  readMaterialHeaderLink,
  readMaterialPagePagination,
  readMaterialRoutes,
  requireParentMaterialRoute,
} from "@/app/[locale]/(app)/(shared)/(main)/(learn)/materials/[subject]/[topic]/[[...lesson]]/data";
import {
  type MaterialPageSource,
  readMaterialMetadata,
  readMaterialPage,
} from "@/app/[locale]/(app)/(shared)/(main)/(learn)/materials/[subject]/[topic]/[[...lesson]]/source";
import { DeferredAiSheetOpen } from "@/components/ai/deferred-sheet-open";
import { DeferredComments } from "@/components/comments/deferred";
import { ComingSoon } from "@/components/shared/coming-soon";
import { FooterContent } from "@/components/shared/footer-content";
import { HeaderContent } from "@/components/shared/header-content";
import { LayoutContent } from "@/components/shared/layout-content";
import { LayoutMaterialContent } from "@/components/shared/material/content";
import { LayoutMaterial } from "@/components/shared/material/layout";
import { LayoutMaterialToc } from "@/components/shared/material/toc";
import { PaginationContent } from "@/components/shared/pagination-content";
import { ContentViewTracker } from "@/components/tracking/tracker";
import { getContentViewId } from "@/lib/content/views";
import { readMaterialContextQuery } from "@/lib/routing/material/query";
import { getOgUrl, getSocialMetadata } from "@/lib/utils/metadata";
import { createProjectedRouteAlternates } from "@/lib/utils/seo/alternates";
import { createBreadcrumbItems } from "@/lib/utils/seo/breadcrumbs";

type MaterialPageProps =
  PageProps<"/[locale]/materials/[subject]/[topic]/[[...lesson]]">;
type MaterialPageContent = Pick<MaterialPageSource, "body" | "metadata">;
type ArrayItem<T> = T extends readonly (infer Item)[] ? Item : T;
type ArticleJsonLdAuthor = ArrayItem<
  Parameters<typeof ArticleJsonLd>[0]["author"]
>;

/** Builds material topic and lesson params from projected public route rows. */
export function generateStaticParams({
  params,
}: {
  params: { locale: string };
}) {
  return listMaterialStaticParams(params.locale);
}

/**
 * Generates SEO metadata for canonical material topic and lesson pages.
 *
 * Public route rows own the localized path, while the runtime row owns the
 * richer authored metadata when the route is a concrete lesson body.
 */
export async function generateMetadata({
  params,
}: MaterialPageProps): Promise<Metadata> {
  const { locale, metadata, route } = await readMaterialMetadata(params);
  const path = toLocalizedContentHref(route);
  const title = metadata?.title ?? route.title;
  const description = metadata?.description ?? route.description ?? route.title;

  return {
    title: { absolute: title },
    description,
    authors: metadata?.authors.map(({ name }) => ({ name })),
    alternates: createProjectedRouteAlternates(route, readMaterialRoutes(), {
      types: { "text/markdown": `${path}.md` },
    }),
    ...getSocialMetadata({
      title,
      description,
      locale,
      path,
      image: getOgUrl(locale, route.publicPath),
      type: "article",
    }),
  };
}

/**
 * Renders the canonical material lesson page.
 *
 * Topic rows are grouping data for curriculum card pages. They intentionally
 * do not render public pages, so the learner opens concrete material content
 * directly from a collapsible card.
 */
export default async function Page({
  params,
  searchParams,
}: MaterialPageProps) {
  const [page, query] = await Promise.all([
    readMaterialPage(params),
    searchParams,
  ]);
  const { locale, route } = page;
  const parentRoute = requireParentMaterialRoute(route);
  const materialContext = readMaterialContextQuery(query ?? {});
  const trackerContext: LearningContextInput | undefined = materialContext
    ? {
        mode: "placement",
        nodeKey: materialContext.nodeKey,
        programKey: materialContext.programKey,
      }
    : undefined;
  const contentId = getContentViewId({
    locale,
    route: route.sourcePath,
  });

  return (
    <ContentViewTracker
      contentId={contentId}
      context={trackerContext}
      locale={locale}
    >
      <MaterialLessonPage
        content={{ body: page.body, metadata: page.metadata }}
        footer={<DeferredComments slug={route.sourcePath} />}
        headerLink={readMaterialHeaderLink(route, materialContext)}
        locale={locale}
        materialContext={materialContext}
        parentTitle={parentRoute.title}
        route={route}
        sourceUrl={page.sourceUrl}
        toolbar={
          <DeferredAiSheetOpen
            audio={{
              contentType: "material",
              locale,
              slug: route.sourcePath,
            }}
            contextTitle={page.metadata.title}
          />
        }
      >
        {page.children}
      </MaterialLessonPage>
    </ContentViewTracker>
  );
}

/**
 * Wraps a concrete material lesson in the established rich lesson shell.
 *
 * Runtime content supplies body, metadata, and graph-backed source identity;
 * route projection supplies the canonical localized URL and sibling links.
 */
async function MaterialLessonPage({
  children,
  content,
  footer,
  headerLink,
  locale,
  materialContext,
  parentTitle,
  route,
  sourceUrl,
  toolbar,
}: {
  children: ReactNode;
  content: MaterialPageContent;
  footer: ReactNode;
  headerLink?: {
    href: string;
    label: string;
  };
  locale: Locale;
  materialContext: MaterialContextIdentity | undefined;
  parentTitle: string;
  route: PublicContentRoute;
  sourceUrl: null | string;
  toolbar: ReactNode;
}) {
  const tCommon = await getTranslations({ locale, namespace: "Common" });
  const icon = getProjectedMaterialIcon(route);
  const raw = content.body;
  const headings = getHeadings(raw);
  const metadata = content.metadata;
  const pagination = readMaterialPagePagination(route, materialContext);
  const publishedAt = Option.getOrElse(
    formatContentDateISO(metadata.date),
    () => metadata.date
  );
  const authorJsonLd: ArticleJsonLdAuthor[] = metadata.authors.map(
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
          { name: metadata.title, path: toLocalizedContentHref(route) },
        ])}
      />
      <ArticleJsonLd
        author={authorJsonLd}
        datePublished={publishedAt}
        description={metadata.description ?? metadata.subject ?? ""}
        headline={metadata.title}
        image={getOgUrl(locale, route.publicPath)}
        url={toLocalizedContentHref(route)}
      />
      <LearningResourceJsonLd
        author={authorJsonLd}
        datePublished={publishedAt}
        description={metadata.description ?? metadata.subject ?? ""}
        educationalLevel={parentTitle}
        name={metadata.title}
      />
      <LayoutMaterial>
        <LayoutMaterialContent>
          <HeaderContent
            content={raw}
            icon={icon}
            link={headerLink ?? { href: "/home", label: tCommon("home") }}
            slug={toLocalizedContentHref(route)}
            sourceUrl={sourceUrl}
            title={metadata.title}
          />
          <LayoutContent>
            {headings.length === 0 && <ComingSoon />}
            {headings.length > 0 ? children : null}
          </LayoutContent>
          <PaginationContent pagination={pagination} />
          <FooterContent>{footer}</FooterContent>
          {toolbar}
        </LayoutMaterialContent>
        <LayoutMaterialToc
          chapters={{
            label: tCommon("on-this-page"),
            data: headings,
          }}
          githubUrl={sourceUrl ?? undefined}
          header={{
            title: metadata.title,
            href: toLocalizedContentHref(route),
            description: metadata.description ?? metadata.subject,
          }}
          showComments
        />
      </LayoutMaterial>
    </>
  );
}
