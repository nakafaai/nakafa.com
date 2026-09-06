import type { ArticleRouteSlug } from "@nakafa/aksara-contracts/projection/article";
import { getHeadings } from "@repo/contents/_lib/toc";
import type { Locale } from "next-intl";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import type { ArticlePageContent } from "@/app/[locale]/(app)/(shared)/(main)/(learn)/articles/[category]/[slug]/content";
import { AiMenuItem } from "@/components/ai/menu";
import { ContentDates } from "@/components/content/dates";
import { ContentHeader } from "@/components/content/header";
import { ComingSoon } from "@/components/shared/coming-soon";
import { FooterContent } from "@/components/shared/footer-content";
import { HeaderContent } from "@/components/shared/header-content";
import { LayoutContent } from "@/components/shared/layout-content";
import { LayoutMaterialContent } from "@/components/shared/material/content";
import { MaterialOutline } from "@/components/shared/material/toc";
import { OpenContent } from "@/components/shared/open-content/actions";
import { SidebarRightProvider } from "@/components/shared/sidebar-right";

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
          items={[
            { href: "/articles", label: tCommon("articles") },
            { href: `/articles/${category}`, label: categoryLabel },
          ]}
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
        <HeaderContent
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
      <MaterialOutline
        chapters={{
          label: tCommon("on-this-page"),
          data: headings,
        }}
        githubUrl={content.sourceUrl ?? undefined}
        header={{
          title: metadata.title,
          href: filePath,
          description: metadata.description,
        }}
        references={{
          title: metadata.title,
          data: content.references.map((reference) => ({ ...reference })),
        }}
        showComments={content.kind === "published"}
      />
    </SidebarRightProvider>
  );
}
