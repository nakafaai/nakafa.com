import { getHeadings } from "@repo/contents/toc";
import { JsonLd } from "@repo/seo/json-ld";
import { makeArticleJsonLd } from "@repo/seo/json-ld/article";
import { getTranslations } from "next-intl/server";
import type { MaterialPageContent } from "@/app/[locale]/(app)/(shared)/(main)/(learn)/materials/[subject]/[topic]/[[...lesson]]/content";
import {
  MaterialBreadcrumb,
  type MaterialContextProps,
  MaterialHeading,
  MaterialPagination,
} from "@/app/[locale]/(app)/(shared)/(main)/(learn)/materials/[subject]/[topic]/[[...lesson]]/context";
import { toMaterialMetadataCopy } from "@/app/[locale]/(app)/(shared)/(main)/(learn)/materials/[subject]/[topic]/[[...lesson]]/metadata";
import {
  toMaterialHref,
  toMaterialNavigationPage,
} from "@/app/[locale]/(app)/(shared)/(main)/(learn)/materials/[subject]/[topic]/[[...lesson]]/navigation";
import { AiMenuItem } from "@/components/ai/sheet/menu";
import { DeferredAiSheetOpen } from "@/components/ai/sheet/trigger";
import { DeferredComments } from "@/components/comments/deferred";
import { ContentDates } from "@/components/content/dates";
import { ContentHeader } from "@/components/content/header";
import { ContentTitle } from "@/components/content/title";
import { BreadcrumbHeaderPath } from "@/components/shared/breadcrumb/header";
import { OpenContent } from "@/components/shared/content/actions";
import { FooterContent } from "@/components/shared/content/footer";
import { LayoutContent } from "@/components/shared/content/layout";
import { LayoutMaterialContent } from "@/components/shared/material/content";
import {
  SidebarRightFooter,
  SidebarRightPanel,
  SidebarRightProvider,
} from "@/components/shared/outline/panel";
import { SidebarTree } from "@/components/shared/outline/tree";
import { ComingSoon } from "@/components/shared/upcoming";
import { CommentsButton } from "@/components/sidebar/actions/comments";
import { GithubButton } from "@/components/sidebar/actions/github";
import { ReportButton } from "@/components/sidebar/actions/report";
import { ShareButton } from "@/components/sidebar/actions/share";
import { getOgUrl } from "@/lib/utils/metadata";

/** Prerenders the signed lesson; optional curriculum context lives in client controls. */
export async function MaterialShell({ page }: { page: MaterialPageContent }) {
  const { appLocale: locale, kind, metadata, route } = page;
  const tCommon = await getTranslations({ locale, namespace: "Common" });
  const headings = getHeadings(page.body);
  const allowsInteractions = kind === "published";
  const context: MaterialContextProps = {
    page: {
      ...toMaterialNavigationPage(page),
      appLocale: locale,
      contentId: route.graph.assetId,
      metadata: {
        title: metadata.title,
        description: metadata.description,
        subject: metadata.subject,
      },
    },
  };
  const copy = toMaterialMetadataCopy(page);
  return (
    <>
      <JsonLd
        jsonLd={makeArticleJsonLd({
          authors: metadata.authors,
          dates: metadata,
          description: copy.description,
          headline: copy.title,
          image: getOgUrl(locale, route.publicPath),
          locale,
          path: toMaterialHref(route),
          trail: [{ name: tCommon("home"), path: `/${locale}` }],
        })}
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
                <MaterialBreadcrumb context={context} />
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
          <MaterialPagination context={context} />
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
          header={<MaterialHeading context={context} />}
        >
          <SidebarTree data={headings} title={tCommon("on-this-page")} />
        </SidebarRightPanel>
      </SidebarRightProvider>
    </>
  );
}
