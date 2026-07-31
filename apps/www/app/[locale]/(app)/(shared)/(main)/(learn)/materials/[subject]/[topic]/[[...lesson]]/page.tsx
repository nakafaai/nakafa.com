import type { LearningContextInput } from "@repo/backend/convex/contents/context";
import { getHeadings } from "@repo/contents/_lib/toc";
import { formatContentDateISO } from "@repo/contents/_shared/date";
import type { ContentPagination } from "@repo/contents/_types/content";
import { ArticleJsonLd } from "@repo/seo/json-ld/article";
import { BreadcrumbJsonLd } from "@repo/seo/json-ld/breadcrumb";
import { LearningResourceJsonLd } from "@repo/seo/json-ld/learning-resource";
import { Option } from "effect";
import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { listMaterialStaticParams } from "@/app/[locale]/(app)/(shared)/(main)/(learn)/materials/[subject]/[topic]/[[...lesson]]/data";
import { toMaterialMetadataCopy } from "@/app/[locale]/(app)/(shared)/(main)/(learn)/materials/[subject]/[topic]/[[...lesson]]/metadata";
import {
  readMaterialAlternates,
  readMaterialContentKey,
  readMaterialIcon,
  readMaterialNavigation,
  readMaterialParentTitle,
  toMaterialHref,
} from "@/app/[locale]/(app)/(shared)/(main)/(learn)/materials/[subject]/[topic]/[[...lesson]]/navigation";
import {
  type MaterialPageSource,
  type MaterialViewRoute,
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
import { createResolvedRouteAlternates } from "@/lib/utils/seo/alternates";
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
  const source = await readMaterialMetadata(params);
  const { locale, metadata, route } = source;
  const path = toMaterialHref(route);
  const { description, title } = toMaterialMetadataCopy(source);

  return {
    title: { absolute: title },
    description,
    authors: metadata?.authors.map(({ name }) => ({ name })),
    alternates: createResolvedRouteAlternates(
      route,
      readMaterialAlternates(source),
      {
        types: { "text/markdown": `${path}.md` },
      }
    ),
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
  const materialContext = readMaterialContextQuery(query ?? {});
  const navigation = await readMaterialNavigation(page, materialContext);
  const trackerContext: LearningContextInput | undefined = navigation.context
    ? {
        mode: "placement",
        nodeKey: navigation.context.nodeKey,
        programKey: navigation.context.programKey,
      }
    : undefined;
  const contentKey = readMaterialContentKey(page);
  const contentId = getContentViewId({
    locale,
    route: contentKey,
  });

  return (
    <ContentViewTracker
      contentId={contentId}
      context={trackerContext}
      locale={locale}
      publicPath={route.publicPath}
      section="material"
    >
      <MaterialLessonPage
        content={{ body: page.body, metadata: page.metadata }}
        footer={<DeferredComments slug={contentKey} />}
        headerLink={navigation.link}
        icon={readMaterialIcon(page)}
        locale={locale}
        pagination={navigation.pagination}
        parentTitle={readMaterialParentTitle(page)}
        route={route}
        sourceUrl={page.sourceUrl}
        toolbar={
          <DeferredAiSheetOpen
            audio={{
              contentType: "material",
              locale,
              slug: contentKey,
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
  icon,
  locale,
  pagination,
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
  icon: ReturnType<typeof readMaterialIcon>;
  locale: Locale;
  pagination: ContentPagination;
  parentTitle: string;
  route: MaterialViewRoute;
  sourceUrl: null | string;
  toolbar: ReactNode;
}) {
  const tCommon = await getTranslations({ locale, namespace: "Common" });
  const raw = content.body;
  const headings = getHeadings(raw);
  const metadata = content.metadata;
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
          { name: metadata.title, path: toMaterialHref(route) },
        ])}
      />
      <ArticleJsonLd
        author={authorJsonLd}
        datePublished={publishedAt}
        description={metadata.description ?? metadata.subject ?? ""}
        headline={metadata.title}
        image={getOgUrl(locale, route.publicPath)}
        url={toMaterialHref(route)}
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
            slug={toMaterialHref(route)}
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
            href: toMaterialHref(route),
            description: metadata.description ?? metadata.subject,
          }}
          showComments
        />
      </LayoutMaterial>
    </>
  );
}
