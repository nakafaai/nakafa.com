import { getHeadings } from "@repo/contents/toc";
import { ArticleJsonLd } from "@repo/seo/json-ld/article";
import { BreadcrumbJsonLd } from "@repo/seo/json-ld/breadcrumb";
import { LearningResourceJsonLd } from "@repo/seo/json-ld/learning-resource";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import type { MaterialPageContent } from "@/app/[locale]/(app)/(shared)/(main)/(learn)/materials/[subject]/[topic]/[[...lesson]]/content";
import {
  MaterialBreadcrumb,
  type MaterialContextProps,
  MaterialHeading,
  MaterialPagination,
} from "@/app/[locale]/(app)/(shared)/(main)/(learn)/materials/[subject]/[topic]/[[...lesson]]/context";
import {
  readMaterialNavigation,
  toMaterialHref,
} from "@/app/[locale]/(app)/(shared)/(main)/(learn)/materials/[subject]/[topic]/[[...lesson]]/navigation";
import { DeferredAiSheetOpen } from "@/components/ai/deferred-sheet-open";
import { AiMenuItem } from "@/components/ai/menu";
import { DeferredComments } from "@/components/comments/deferred";
import { ContentDates } from "@/components/content/dates";
import { ContentHeader } from "@/components/content/header";
import { ContentTitle } from "@/components/content/title";
import { BreadcrumbHeaderPath } from "@/components/shared/breadcrumb/header";
import { ComingSoon } from "@/components/shared/coming-soon";
import { FooterContent } from "@/components/shared/footer-content";
import { LayoutContent } from "@/components/shared/layout-content";
import { LayoutMaterialContent } from "@/components/shared/material/content";
import { MaterialOutline } from "@/components/shared/material/toc";
import { OpenContent } from "@/components/shared/open-content/actions";
import { PaginationContent } from "@/components/shared/pagination-content";
import {
  SidebarRightHeader,
  SidebarRightProvider,
} from "@/components/shared/sidebar-right";
import { createBreadcrumbItems } from "@/lib/seo/breadcrumbs";
import { getOgUrl } from "@/lib/utils/metadata";

type ArrayItem<T> = T extends readonly (infer Item)[] ? Item : T;
type ArticleJsonLdAuthor = ArrayItem<
  Parameters<typeof ArticleJsonLd>[0]["author"]
>;

/** Prerenders the signed lesson; optional curriculum context lives in client controls. */
export async function MaterialShell({ page }: { page: MaterialPageContent }) {
  const { appLocale: locale, kind, metadata, route, siblings } = page;
  const tCommon = await getTranslations({ locale, namespace: "Common" });
  const headings = getHeadings(page.body);
  const allowsInteractions = kind === "published";
  const context: MaterialContextProps = {
    page: {
      appLocale: locale,
      contentId: route.graph.assetId,
      kind,
      metadata: {
        title: metadata.title,
        description: metadata.description,
        subject: metadata.subject,
      },
      route: {
        appLocale: route.appLocale,
        contentKey: route.contentKey,
        materialKey: route.materialKey,
        parentPath: route.parentPath,
        publicPath: route.publicPath,
      },
      siblings: siblings.map((sibling) => ({
        appLocale: sibling.appLocale,
        metadata: { title: sibling.metadata.title },
        order: sibling.order,
        parentPath: sibling.parentPath,
        publicPath: sibling.publicPath,
      })),
    },
  };
  const navigation = readMaterialNavigation(page, null);
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
        dateModified={metadata.dateModified}
        datePublished={metadata.datePublished}
        description={metadata.description ?? metadata.subject}
        headline={metadata.title}
        image={getOgUrl(locale, route.publicPath)}
        url={toMaterialHref(route)}
      />
      <LearningResourceJsonLd
        author={authorJsonLd}
        dateModified={metadata.dateModified}
        datePublished={metadata.datePublished}
        description={metadata.description ?? metadata.subject}
        educationalLevel={route.topicTitle}
        name={metadata.title}
      />
      <SidebarRightProvider>
        <LayoutMaterialContent>
          <ContentHeader
            breadcrumb={
              <BreadcrumbHeaderPath
                homeLabel={tCommon("home")}
                items={[]}
                menuLabel={tCommon("more")}
              >
                <Suspense fallback={null}>
                  <MaterialBreadcrumb context={context} />
                </Suspense>
              </BreadcrumbHeaderPath>
            }
          >
            <OpenContent
              content={page.copySourceUrl ? undefined : page.body}
              copySourceUrl={page.copySourceUrl}
              slug={toMaterialHref(route)}
              sourceUrl={page.sourceUrl}
            >
              {allowsInteractions && (
                <AiMenuItem contextTitle={metadata.title} />
              )}
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
            {headings.length === 0 && <ComingSoon />}
            {headings.length > 0 ? page.children : null}
          </LayoutContent>
          <Suspense
            fallback={<PaginationContent pagination={navigation.pagination} />}
          >
            <MaterialPagination context={context} />
          </Suspense>
          {allowsInteractions ? (
            <FooterContent>
              <DeferredComments slug={route.contentKey} />
            </FooterContent>
          ) : null}
          {allowsInteractions ? (
            <DeferredAiSheetOpen contextTitle={metadata.title} />
          ) : null}
        </LayoutMaterialContent>
        <MaterialOutline
          chapters={{ label: tCommon("on-this-page"), data: headings }}
          githubUrl={page.sourceUrl ?? undefined}
          header={
            <Suspense
              fallback={
                <SidebarRightHeader
                  description={metadata.description ?? metadata.subject}
                  href={navigation.currentHref}
                  title={metadata.title}
                />
              }
            >
              <MaterialHeading context={context} />
            </Suspense>
          }
          showComments={allowsInteractions}
        />
      </SidebarRightProvider>
    </>
  );
}
