import type { ArticleRouteSlug } from "@nakafa/aksara-contracts/projection/article";
import { getHeadings } from "@repo/contents/_lib/toc";
import type { Locale } from "next-intl";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import type { ArticlePageContent } from "@/app/[locale]/(app)/(shared)/(main)/(learn)/articles/[category]/[slug]/content";
import { ContentDates } from "@/components/content/dates";
import { ComingSoon } from "@/components/shared/coming-soon";
import { FooterContent } from "@/components/shared/footer-content";
import { HeaderContent } from "@/components/shared/header-content";
import { LayoutContent } from "@/components/shared/layout-content";
import { LayoutMaterialContent } from "@/components/shared/material/content";
import { LayoutMaterialToc } from "@/components/shared/material/toc";

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
    <>
      <LayoutMaterialContent>
        <HeaderContent
          content={content.copySourceUrl ? undefined : raw}
          copySourceUrl={content.copySourceUrl}
          description={metadata.description}
          link={{
            href: `/articles/${category}`,
            label: categoryLabel,
          }}
          slug={`/${locale}${filePath}`}
          sourceUrl={content.sourceUrl}
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
      <LayoutMaterialToc
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
    </>
  );
}
