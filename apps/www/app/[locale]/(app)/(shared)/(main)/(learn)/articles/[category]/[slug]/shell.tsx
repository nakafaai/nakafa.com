import type { ArticleCategory } from "@nakafa/aksara-contracts/projection/article";
import { getHeadings } from "@repo/contents/_lib/toc";
import type { Locale } from "next-intl";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import type { ArticlePageSource } from "@/app/[locale]/(app)/(shared)/(main)/(learn)/articles/[category]/[slug]/source";
import { ComingSoon } from "@/components/shared/coming-soon";
import { FooterContent } from "@/components/shared/footer-content";
import { HeaderContent } from "@/components/shared/header-content";
import { LayoutContent } from "@/components/shared/layout-content";
import { LayoutMaterialContent } from "@/components/shared/material/content";
import { LayoutMaterial } from "@/components/shared/material/layout";
import { LayoutMaterialToc } from "@/components/shared/material/toc";

/** Renders an article body and its route-owned navigation around either source implementation. */
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
  category: ArticleCategory;
  categoryLabel: string;
  filePath: string;
  content: ArticlePageSource;
  children: ReactNode;
  footer: ReactNode;
  toolbar: ReactNode;
}) {
  const tCommon = await getTranslations("Common");
  const metadata = content.metadata;
  const raw = content.body;
  const headings = getHeadings(raw);

  return (
    <LayoutMaterial>
      <LayoutMaterialContent>
        <HeaderContent
          content={raw}
          description={metadata.description}
          link={{
            href: `/articles/${category}`,
            label: categoryLabel,
          }}
          slug={`/${locale}${filePath}`}
          sourceUrl={content.sourceUrl}
          title={metadata.title}
        />
        <LayoutContent>
          {headings.length === 0 && <ComingSoon />}
          {headings.length > 0 ? children : null}
        </LayoutContent>
        <FooterContent>{footer}</FooterContent>
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
        showComments
      />
    </LayoutMaterial>
  );
}
