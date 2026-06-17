import { getHeadings } from "@repo/contents/_lib/toc";
import { formatContentDateISO } from "@repo/contents/_shared/date";
import {
  isMaterialLessonRoute,
  readMaterialPagination,
  toLocalizedContentHref,
} from "@repo/contents/_types/route/content";
import type { PublicContentRoute } from "@repo/contents/_types/route/schema";
import { ArticleJsonLd } from "@repo/seo/json-ld/article";
import { BreadcrumbJsonLd } from "@repo/seo/json-ld/breadcrumb";
import { LearningResourceJsonLd } from "@repo/seo/json-ld/learning-resource";
import { Option } from "effect";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { Locale } from "next-intl";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import {
  getProjectedMaterialIcon,
  listMaterialStaticParams,
  MATERIAL_ROUTES,
  readMaterialHeaderLink,
  requireParentMaterialRoute,
  resolveMaterialRoute,
} from "@/app/[locale]/(app)/(shared)/(main)/(learn)/materials/[subject]/[topic]/[[...lesson]]/data";
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
import { importContentModuleOrNull } from "@/lib/content/module";
import { fetchRuntimeCurriculumPage } from "@/lib/content/runtime";
import { getGithubUrl } from "@/lib/utils/github";
import { getOgUrl, getSocialMetadata } from "@/lib/utils/metadata";
import { createProjectedRouteAlternates } from "@/lib/utils/seo/alternates";
import { createBreadcrumbItems } from "@/lib/utils/seo/breadcrumbs";

type MaterialPageProps =
  PageProps<"/[locale]/materials/[subject]/[topic]/[[...lesson]]">;
type RuntimeLessonPage = NonNullable<
  Awaited<ReturnType<typeof fetchRuntimeCurriculumPage>>
>;
type ArrayItem<T> = T extends readonly (infer Item)[] ? Item : T;
type ArticleJsonLdAuthor = ArrayItem<
  Parameters<typeof ArticleJsonLd>[0]["author"]
>;

/** Builds material topic and lesson params from projected public route rows. */
export function generateStaticParams() {
  return listMaterialStaticParams();
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
  const { locale, route } = await resolveMaterialRoute(params);
  const path = toLocalizedContentHref(route);
  const runtimeLesson = await fetchRuntimeCurriculumPage({
    locale,
    slug: route.sourcePath,
  });
  const title = runtimeLesson?.metadata.title ?? route.title;
  const description =
    runtimeLesson?.metadata.description ?? route.description ?? route.title;

  return {
    title: { absolute: title },
    description,
    authors: runtimeLesson?.metadata.authors,
    alternates: createProjectedRouteAlternates(route, MATERIAL_ROUTES, {
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
 * Topic rows are grouping data for curriculum card pages. They intentionally do
 * do not render public pages, so the learner opens concrete material content
 * directly from a collapsible card.
 */
export default async function Page({ params }: MaterialPageProps) {
  const { locale, route } = await resolveMaterialRoute(params);

  if (!isMaterialLessonRoute(route)) {
    notFound();
  }

  const runtimeLesson = await fetchRuntimeCurriculumPage({
    locale,
    slug: route.sourcePath,
  });

  if (!runtimeLesson) {
    notFound();
  }

  const content = await importContentModuleOrNull({
    filePath: route.sourcePath,
    locale,
    source: "material-public-route",
  });

  if (!content?.default) {
    notFound();
  }

  const Content = content.default;
  const parentRoute = requireParentMaterialRoute(route);

  return (
    <MaterialLessonPage
      content={runtimeLesson}
      footer={<DeferredComments slug={`/${route.publicPath}`} />}
      headerLink={readMaterialHeaderLink(route)}
      locale={locale}
      parentTitle={parentRoute.title}
      route={route}
      toolbar={
        <DeferredAiSheetOpen
          audio={{
            contentType: "material",
            locale,
            slug: route.sourcePath,
          }}
          contextTitle={runtimeLesson.metadata.title}
        />
      }
    >
      <Content />
    </MaterialLessonPage>
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
  parentTitle,
  route,
  toolbar,
}: {
  children: ReactNode;
  content: RuntimeLessonPage;
  footer: ReactNode;
  headerLink?: {
    href: string;
    label: string;
  };
  locale: Locale;
  parentTitle: string;
  route: PublicContentRoute;
  toolbar: ReactNode;
}) {
  const tCommon = await getTranslations({ locale, namespace: "Common" });
  const icon = getProjectedMaterialIcon(route);
  const raw = content.body;
  const headings = getHeadings(raw);
  const metadata = content.metadata;
  const pagination = readMaterialPagination(route, MATERIAL_ROUTES);
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
            link={headerLink}
            slug={toLocalizedContentHref(route)}
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
          githubUrl={getGithubUrl({
            path: `/packages/contents/${route.sourcePath}`,
          })}
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
