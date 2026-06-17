import { getHeadings } from "@repo/contents/_lib/toc";
import { formatContentDateISO } from "@repo/contents/_shared/date";
import { slugify } from "@repo/design-system/lib/utils";
import { ArticleJsonLd } from "@repo/seo/json-ld/article";
import { BreadcrumbJsonLd } from "@repo/seo/json-ld/breadcrumb";
import { CollectionPageJsonLd } from "@repo/seo/json-ld/collection-page";
import { LearningResourceJsonLd } from "@repo/seo/json-ld/learning-resource";
import { Option } from "effect";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { Locale } from "next-intl";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import {
  getMaterialPagination,
  getProjectedMaterialIcon,
  isMaterialLessonRoute,
  isMaterialTopicRoute,
  listMaterialStaticParams,
  MATERIAL_ROUTES,
  type MaterialLessonRoute,
  type MaterialTopicRoute,
  requireParentMaterialRoute,
  resolveMaterialRoute,
  toLocalizedHref,
  toMaterialCardList,
} from "@/app/[locale]/(app)/(shared)/(main)/(learn)/materials/[subject]/[topic]/[[...lesson]]/data";
import { DeferredAiSheetOpen } from "@/components/ai/deferred-sheet-open";
import { DeferredComments } from "@/components/comments/deferred";
import { CardMaterial } from "@/components/shared/card-material";
import { ComingSoon } from "@/components/shared/coming-soon";
import { ContainerList } from "@/components/shared/container-list";
import { FooterContent } from "@/components/shared/footer-content";
import { HeaderContent } from "@/components/shared/header-content";
import { LayoutContent } from "@/components/shared/layout-content";
import { LayoutMaterialContent } from "@/components/shared/material/content";
import { LayoutMaterial } from "@/components/shared/material/layout";
import { LayoutMaterialToc } from "@/components/shared/material/toc";
import { PaginationContent } from "@/components/shared/pagination-content";
import { RefContent } from "@/components/shared/ref-content";
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
  const path = toLocalizedHref(route);
  const runtimeLesson =
    route.kind === "subject-lesson"
      ? await fetchRuntimeCurriculumPage({
          locale,
          slug: route.sourcePath,
        })
      : null;
  const title = runtimeLesson?.metadata.title ?? route.title;
  const description =
    runtimeLesson?.metadata.description ?? route.description ?? route.title;

  const alternateOptions =
    route.kind === "subject-lesson"
      ? { types: { "text/markdown": `${path}.md` } }
      : {};

  return {
    title: { absolute: title },
    description,
    authors: runtimeLesson?.metadata.authors,
    alternates: createProjectedRouteAlternates(
      route,
      MATERIAL_ROUTES,
      alternateOptions
    ),
    ...getSocialMetadata({
      title,
      description,
      locale,
      path,
      image: getOgUrl(locale, route.publicPath),
      type: route.kind === "subject-lesson" ? "article" : "website",
    }),
  };
}

/**
 * Renders the canonical material topic or lesson page.
 *
 * Topic pages reuse the existing collapsible material-card UX. Lesson pages
 * reuse the rich material shell with TOC, comments, references, pagination, and
 * AI/audio actions.
 */
export default async function Page({ params }: MaterialPageProps) {
  const { locale, route } = await resolveMaterialRoute(params);

  if (isMaterialTopicRoute(route)) {
    return <MaterialTopicPage locale={locale} route={route} />;
  }

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
 * Renders a material topic using the production collapsible card composition.
 *
 * This preserves the old subject topic UX while replacing old route identity
 * with projected public material routes.
 */
async function MaterialTopicPage({
  locale,
  route,
}: {
  locale: Locale;
  route: MaterialTopicRoute;
}) {
  const tCommon = await getTranslations({ locale, namespace: "Common" });
  const materials = toMaterialCardList(route);
  const icon = getProjectedMaterialIcon(route);
  const chapters = materials.map((material) => ({
    label: material.title,
    href: `#${slugify(material.title)}`,
    children: [],
  }));

  return (
    <>
      <BreadcrumbJsonLd
        breadcrumbItems={createBreadcrumbItems(locale, [
          { name: tCommon("home"), path: "" },
          { name: route.title, path: toLocalizedHref(route) },
        ])}
      />
      <CollectionPageJsonLd
        description={route.description ?? route.title}
        items={materials.flatMap((material) =>
          material.items.map((item) => ({
            name: item.title,
            url: `https://nakafa.com${item.href}`,
          }))
        )}
        name={route.title}
        url={`https://nakafa.com${toLocalizedHref(route)}`}
      />
      <LayoutMaterial>
        <LayoutMaterialContent>
          <HeaderContent
            description={route.description}
            icon={icon}
            title={route.title}
          />
          <LayoutContent>
            <ContainerList className="sm:grid-cols-1">
              {materials.map((material) => (
                <CardMaterial key={material.href} material={material} />
              ))}
            </ContainerList>
          </LayoutContent>
          <FooterContent>
            <RefContent
              githubUrl={getGithubUrl({
                path: `/packages/contents/${route.sourcePath}`,
              })}
            />
          </FooterContent>
        </LayoutMaterialContent>
        <LayoutMaterialToc
          chapters={{
            label: route.title,
            data: chapters,
          }}
          githubUrl={getGithubUrl({
            path: `/packages/contents/${route.sourcePath}`,
          })}
          header={{
            title: route.title,
            href: toLocalizedHref(route),
            description: route.description,
          }}
        />
      </LayoutMaterial>
    </>
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
  locale,
  parentTitle,
  route,
  toolbar,
}: {
  children: ReactNode;
  content: RuntimeLessonPage;
  footer: ReactNode;
  locale: Locale;
  parentTitle: string;
  route: MaterialLessonRoute;
  toolbar: ReactNode;
}) {
  const tCommon = await getTranslations({ locale, namespace: "Common" });
  const icon = getProjectedMaterialIcon(route);
  const raw = content.body;
  const headings = getHeadings(raw);
  const metadata = content.metadata;
  const parentRoute = requireParentMaterialRoute(route);
  const pagination = getMaterialPagination(route);
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
          { name: parentTitle, path: toLocalizedHref(parentRoute) },
          { name: metadata.title, path: toLocalizedHref(route) },
        ])}
      />
      <ArticleJsonLd
        author={authorJsonLd}
        datePublished={publishedAt}
        description={metadata.description ?? metadata.subject ?? ""}
        headline={metadata.title}
        image={getOgUrl(locale, route.publicPath)}
        url={toLocalizedHref(route)}
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
            link={{
              href: `${toLocalizedHref(parentRoute)}#${slugify(parentTitle)}`,
              label: parentTitle,
            }}
            slug={toLocalizedHref(route)}
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
            href: toLocalizedHref(route),
            description: metadata.description ?? metadata.subject,
          }}
          showComments
        />
      </LayoutMaterial>
    </>
  );
}
