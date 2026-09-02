import type { LearningContextInput } from "@repo/backend/convex/contents/context";
import { getMaterialIcon } from "@repo/contents/_lib/curriculum/material";
import { getHeadings } from "@repo/contents/_lib/toc";
import type { ContentPagination } from "@repo/contents/_types/content";
import { ArticleJsonLd } from "@repo/seo/json-ld/article";
import { BreadcrumbJsonLd } from "@repo/seo/json-ld/breadcrumb";
import { LearningResourceJsonLd } from "@repo/seo/json-ld/learning-resource";
import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { type ReactNode, Suspense } from "react";
import {
  type MaterialPageContent,
  readMaterialMetadata,
  readMaterialPage,
} from "@/app/[locale]/(app)/(shared)/(main)/(learn)/materials/[subject]/[topic]/[[...lesson]]/content";
import { listMaterialStaticParams } from "@/app/[locale]/(app)/(shared)/(main)/(learn)/materials/[subject]/[topic]/[[...lesson]]/data";
import { toMaterialMetadataCopy } from "@/app/[locale]/(app)/(shared)/(main)/(learn)/materials/[subject]/[topic]/[[...lesson]]/metadata";
import {
  readMaterialNavigation,
  toMaterialHref,
} from "@/app/[locale]/(app)/(shared)/(main)/(learn)/materials/[subject]/[topic]/[[...lesson]]/navigation";
import { DeferredAiSheetOpen } from "@/components/ai/deferred-sheet-open";
import { DeferredComments } from "@/components/comments/deferred";
import { ContentDates } from "@/components/content/dates";
import { ComingSoon } from "@/components/shared/coming-soon";
import { FooterContent } from "@/components/shared/footer-content";
import { HeaderContent } from "@/components/shared/header-content";
import { LayoutContent } from "@/components/shared/layout-content";
import { LayoutMaterialContent } from "@/components/shared/material/content";
import { LayoutMaterial } from "@/components/shared/material/layout";
import { LayoutMaterialToc } from "@/components/shared/material/toc";
import { PaginationContent } from "@/components/shared/pagination-content";
import { ContentViewTracker } from "@/components/tracking/tracker";
import { readMaterialContextQuery } from "@/lib/routing/material/query";
import { createResolvedRouteAlternates } from "@/lib/seo/alternates";
import { createBreadcrumbItems } from "@/lib/seo/breadcrumbs";
import { getOgUrl, getSocialMetadata } from "@/lib/utils/metadata";

type MaterialPageProps =
  PageProps<"/[locale]/materials/[subject]/[topic]/[[...lesson]]">;
type MaterialBody = Pick<MaterialPageContent, "body" | "metadata">;
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
  const { appLocale, metadata, route } = source;
  const path = toMaterialHref(route);
  const { description, title } = toMaterialMetadataCopy(source);

  return {
    title: { absolute: title },
    description,
    authors: metadata?.authors.map(({ name }) => ({ name })),
    alternates: createResolvedRouteAlternates(route, source.alternates, {
      types: { "text/markdown": `${path}.md` },
    }),
    ...getSocialMetadata({
      title,
      description,
      locale: appLocale,
      path,
      image: getOgUrl(appLocale, route.publicPath),
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
export default function Page(props: MaterialPageProps) {
  return (
    <LayoutMaterial>
      <Suspense fallback={null}>
        <MaterialRouteContent {...props} />
      </Suspense>
    </LayoutMaterial>
  );
}

/** Resolves the URL-specific signed material inside its streaming boundary. */
async function MaterialRouteContent({
  params,
  searchParams,
}: MaterialPageProps) {
  const [page, query] = await Promise.all([
    readMaterialPage(params),
    searchParams,
  ]);
  const { appLocale, route } = page;
  const materialContext = readMaterialContextQuery(query ?? {});
  const navigation = await readMaterialNavigation(page, materialContext);
  const trackerContext: LearningContextInput | undefined = navigation.context
    ? {
        mode: "placement",
        nodeKey: navigation.context.nodeKey,
        programKey: navigation.context.programKey,
      }
    : undefined;
  const contentKey = page.route.contentKey;
  const contentId = page.route.graph.assetId;
  const allowsInteractions = page.kind === "published";

  return (
    <ContentViewTracker
      contentId={contentId}
      context={trackerContext}
      enabled={allowsInteractions}
      locale={appLocale}
      publicPath={route.publicPath}
      section="material"
    >
      <MaterialLessonPage
        content={{ body: page.body, metadata: page.metadata }}
        copyContent={page.copySourceUrl ? undefined : page.body}
        copySourceUrl={page.copySourceUrl}
        currentHref={navigation.currentHref}
        footer={
          allowsInteractions ? <DeferredComments slug={contentKey} /> : null
        }
        headerLink={navigation.link}
        icon={getMaterialIcon(page.rendererDomain)}
        locale={appLocale}
        pagination={navigation.pagination}
        parentTitle={page.route.topicTitle}
        route={route}
        showComments={allowsInteractions}
        sourceUrl={page.sourceUrl}
        toolbar={
          allowsInteractions ? (
            <DeferredAiSheetOpen contextTitle={page.metadata.title} />
          ) : null
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
  copyContent,
  copySourceUrl,
  currentHref,
  footer,
  headerLink,
  icon,
  locale,
  pagination,
  parentTitle,
  route,
  showComments,
  sourceUrl,
  toolbar,
}: {
  children: ReactNode;
  content: MaterialBody;
  copyContent?: string;
  copySourceUrl: null | string;
  currentHref: string;
  footer: ReactNode;
  headerLink?: {
    href: string;
    label: string;
  };
  icon: ReturnType<typeof getMaterialIcon>;
  locale: Locale;
  pagination: ContentPagination;
  parentTitle: string;
  route: MaterialPageContent["route"];
  showComments: boolean;
  sourceUrl: null | string;
  toolbar: ReactNode;
}) {
  const tCommon = await getTranslations({ locale, namespace: "Common" });
  const raw = content.body;
  const headings = getHeadings(raw);
  const metadata = content.metadata;
  const publishedAt = metadata.datePublished;
  const modifiedAt = metadata.dateModified;
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
        dateModified={modifiedAt}
        datePublished={publishedAt}
        description={metadata.description ?? metadata.subject}
        headline={metadata.title}
        image={getOgUrl(locale, route.publicPath)}
        url={toMaterialHref(route)}
      />
      <LearningResourceJsonLd
        author={authorJsonLd}
        dateModified={modifiedAt}
        datePublished={publishedAt}
        description={metadata.description ?? metadata.subject}
        educationalLevel={parentTitle}
        name={metadata.title}
      />
      <LayoutMaterialContent>
        <HeaderContent
          content={copyContent}
          copySourceUrl={copySourceUrl}
          icon={icon}
          link={headerLink ?? { href: "/home", label: tCommon("home") }}
          slug={toMaterialHref(route)}
          sourceUrl={sourceUrl}
          title={metadata.title}
        />
        <ContentDates
          {...(metadata.dateModified === undefined
            ? {}
            : { dateModified: metadata.dateModified })}
          datePublished={metadata.datePublished}
        />
        <LayoutContent>
          {headings.length === 0 && <ComingSoon />}
          {headings.length > 0 ? children : null}
        </LayoutContent>
        <PaginationContent pagination={pagination} />
        {footer ? <FooterContent>{footer}</FooterContent> : null}
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
          href: currentHref,
          description: metadata.description ?? metadata.subject,
        }}
        showComments={showComments}
      />
    </>
  );
}
