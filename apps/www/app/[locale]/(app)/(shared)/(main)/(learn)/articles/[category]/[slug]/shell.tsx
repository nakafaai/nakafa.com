import type { ArticleRouteSlug } from "@nakafa/aksara-contracts/projection/article";
import { getHeadings } from "@repo/contents/toc";
import { Array as Arr } from "effect";
import type { Locale } from "next-intl";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import type { ArticlePageContent } from "@/app/[locale]/(app)/(shared)/(main)/(learn)/articles/[category]/[slug]/content";
import { AiMenuItem } from "@/components/ai/sheet/menu";
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
  SidebarRightHeader,
  SidebarRightPanel,
  SidebarRightProvider,
} from "@/components/shared/outline/panel";
import { SidebarTree } from "@/components/shared/outline/tree";
import { ComingSoon } from "@/components/shared/upcoming";
import { CommentsButton } from "@/components/sidebar/actions/comments";
import { GithubButton } from "@/components/sidebar/actions/github";
import { ReferenceButton } from "@/components/sidebar/actions/reference";
import { ReportButton } from "@/components/sidebar/actions/report";
import { ShareButton } from "@/components/sidebar/actions/share";

/** Renders a signed article body and its route-owned navigation. */
export async function ArticleShell({
  locale,
  category,
  categoryLabel,
  filePath,
  content,
  children,
  footer,
  toolbar,
}: {
  locale: Locale;
  category: ArticleRouteSlug;
  categoryLabel: string;
  filePath: string;
  content: ArticlePageContent;
  children: ReactNode;
  footer: ReactNode;
  toolbar: ReactNode;
}) {
  const tCommon = await getTranslations("Common");
  const metadata = content.metadata;
  const raw = content.body;
  const headings = getHeadings(raw);

  return (
    <SidebarRightProvider>
      <LayoutMaterialContent>
        <ContentHeader
          breadcrumb={
            <BreadcrumbHeaderPath
              homeLabel={tCommon("home")}
              items={[
                { href: "/articles", label: tCommon("articles") },
                { href: `/articles/${category}`, label: categoryLabel },
              ]}
              menuLabel={tCommon("more")}
            />
          }
        >
          <OpenContent
            content={content.copySourceUrl ? undefined : raw}
            copySourceUrl={content.copySourceUrl}
            slug={`/${locale}${filePath}`}
            sourceUrl={content.sourceUrl}
          >
            {content.kind === "published" && (
              <AiMenuItem contextTitle={metadata.title} />
            )}
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
          {headings.length === 0 && <ComingSoon />}
          {headings.length > 0 ? children : null}
        </LayoutContent>
        {footer ? <FooterContent>{footer}</FooterContent> : null}
        {toolbar}
      </LayoutMaterialContent>
      <SidebarRightPanel
        footer={
          <SidebarRightFooter>
            {content.kind === "published" ? <CommentsButton /> : null}
            <ReferenceButton
              references={Arr.map(content.references, (reference) => ({
                ...reference,
              }))}
              title={metadata.title}
            />
            <ReportButton />
            {content.sourceUrl ? (
              <GithubButton githubUrl={content.sourceUrl} />
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
        <SidebarTree data={headings} title={tCommon("on-this-page")} />
      </SidebarRightPanel>
    </SidebarRightProvider>
  );
}
