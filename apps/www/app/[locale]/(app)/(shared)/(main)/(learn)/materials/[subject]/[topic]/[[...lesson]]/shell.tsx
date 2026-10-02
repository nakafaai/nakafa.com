import { getHeadings } from "@repo/contents/toc";
import { ArticleJsonLd } from "@repo/seo/json-ld/article";
import { BreadcrumbJsonLd } from "@repo/seo/json-ld/breadcrumb";
import { LearningResourceJsonLd } from "@repo/seo/json-ld/learning-resource";
import { getTranslations } from "next-intl/server";
import { type ReactNode, Suspense } from "react";
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
import { AiMenuItem } from "@/components/ai/sheet/menu";
import { DeferredAiSheetOpen } from "@/components/ai/sheet/trigger";
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
import { LayoutContent } from "@/components/shared/content/layout";
import { PaginationContent } from "@/components/shared/content/pagination";
import { LayoutMaterialContent } from "@/components/shared/material/content";
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
import { createBreadcrumbItems } from "@/lib/seo/breadcrumbs";
import { getOgUrl } from "@/lib/utils/metadata";

type ArrayItem<T> = T extends readonly (infer Item)[] ? Item : T;
type ArticleJsonLdAuthor = ArrayItem<
  Parameters<typeof ArticleJsonLd>[0]["author"]
>;

/**
 * Holds one piece of the lesson's static navigation beside its counterpart
 * that carries a verified learning context.
 *
 * The static navigation is server HTML, so it hydrates with the page and
 * answers a click from the first paint. The counterpart reads the URL's
 * context hint, which a prerender cannot know, so it renders only in the
 * browser, and only once the context is verified; while it is mounted, the
 * static navigation it replaces stays hidden.
 */
function MaterialContextSlot({
  children,
  contextual,
}: {
  children: ReactNode;
  contextual: ReactNode;
}) {
  return (
    <div className="group/context contents">
      <div className="contents group-has-[[data-material-context]]/context:hidden">
        {children}
      </div>
      <Suspense fallback={null}>{contextual}</Suspense>
    </div>
  );
}

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
                <Suspense
                  fallback={
                    <BreadcrumbHeaderSegment item={{ label: metadata.title }} />
                  }
                >
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
          <MaterialContextSlot
            contextual={<MaterialPagination context={context} />}
          >
            <PaginationContent pagination={navigation.pagination} />
          </MaterialContextSlot>
          {allowsInteractions ? (
            <FooterContent>
              <DeferredComments slug={route.contentKey} />
            </FooterContent>
          ) : null}
          {allowsInteractions ? (
            <DeferredAiSheetOpen contextTitle={metadata.title} />
          ) : null}
        </LayoutMaterialContent>
        <SidebarRightPanel
          footer={
            <SidebarRightFooter>
              {allowsInteractions ? <CommentsButton /> : null}
              <ReportButton />
              {page.sourceUrl ? (
                <GithubButton githubUrl={page.sourceUrl} />
              ) : null}
              <ShareButton />
            </SidebarRightFooter>
          }
          header={
            <MaterialContextSlot
              contextual={<MaterialHeading context={context} />}
            >
              <SidebarRightHeader
                description={metadata.description ?? metadata.subject}
                href={navigation.currentHref}
                title={metadata.title}
              />
            </MaterialContextSlot>
          }
        >
          <SidebarTree data={headings} title={tCommon("on-this-page")} />
        </SidebarRightPanel>
      </SidebarRightProvider>
    </>
  );
}
