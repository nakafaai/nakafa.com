import type { MaterialMetadata } from "@nakafa/aksara-contracts/projection/material";
import type { RendererDomain } from "@nakafa/aksara-contracts/renderer/domain";
import { getMaterialIcon } from "@repo/contents/_lib/curriculum/material";
import { getHeadings } from "@repo/contents/_lib/toc";
import { formatContentDateISO } from "@repo/contents/_shared/date";
import { toLocalizedContentHref } from "@repo/contents/_types/route/content";
import type { MaterialContextIdentity } from "@repo/contents/_types/route/material/reference";
import type { PublicContentRoute } from "@repo/contents/_types/route/schema";
import { ArticleJsonLd } from "@repo/seo/json-ld/article";
import { BreadcrumbJsonLd } from "@repo/seo/json-ld/breadcrumb";
import { LearningResourceJsonLd } from "@repo/seo/json-ld/learning-resource";
import { Option } from "effect";
import type { Locale } from "next-intl";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { readMaterialPagePagination } from "@/app/[locale]/(app)/(shared)/(main)/(learn)/materials/navigation";
import { ComingSoon } from "@/components/shared/coming-soon";
import { FooterContent } from "@/components/shared/footer-content";
import { HeaderContent } from "@/components/shared/header-content";
import { LayoutContent } from "@/components/shared/layout-content";
import { LayoutMaterialContent } from "@/components/shared/material/content";
import { LayoutMaterial } from "@/components/shared/material/layout";
import { LayoutMaterialToc } from "@/components/shared/material/toc";
import { PaginationContent } from "@/components/shared/pagination-content";
import { getOgUrl } from "@/lib/utils/metadata";
import { createBreadcrumbItems } from "@/lib/utils/seo/breadcrumbs";

type ArrayItem<T> = T extends readonly (infer Item)[] ? Item : T;
type ArticleJsonLdAuthor = ArrayItem<
  Parameters<typeof ArticleJsonLd>[0]["author"]
>;

/** Authored body and metadata accepted by the shared material shell. */
export interface MaterialPageContent {
  readonly body: string;
  readonly metadata: MaterialMetadata;
}

/**
 * Renders one concrete material lesson in the established Nakafa page shell.
 *
 * Route wrappers supply only content and domain-owned registry behavior; this
 * Module remains the single owner of layout, SEO, navigation, and TOC markup.
 */
export async function MaterialLessonPage({
  children,
  content,
  footer,
  headerLink,
  locale,
  materialContext,
  parentTitle,
  rendererDomain,
  route,
  sourceUrl,
  toolbar,
}: {
  readonly children: ReactNode;
  readonly content: MaterialPageContent;
  readonly footer: ReactNode;
  readonly headerLink?: {
    readonly href: string;
    readonly label: string;
  };
  readonly locale: Locale;
  readonly materialContext: MaterialContextIdentity | undefined;
  readonly parentTitle: string;
  readonly rendererDomain: RendererDomain;
  readonly route: PublicContentRoute;
  readonly sourceUrl?: string;
  readonly toolbar: ReactNode;
}) {
  const tCommon = await getTranslations({ locale, namespace: "Common" });
  const icon = getMaterialIcon(rendererDomain);
  const raw = content.body;
  const headings = getHeadings(raw);
  const metadata = content.metadata;
  const pagination = readMaterialPagePagination(route, materialContext);
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
        description={metadata.description ?? metadata.subject ?? metadata.title}
        headline={metadata.title}
        image={getOgUrl(locale, route.publicPath)}
        url={toLocalizedContentHref(route)}
      />
      <LearningResourceJsonLd
        author={authorJsonLd}
        datePublished={publishedAt}
        description={metadata.description ?? metadata.subject ?? metadata.title}
        educationalLevel={parentTitle}
        name={metadata.title}
      />
      <LayoutMaterial>
        <LayoutMaterialContent>
          <HeaderContent
            content={raw}
            icon={icon}
            link={headerLink ?? { href: "/home", label: tCommon("home") }}
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
          chapters={{ label: tCommon("on-this-page"), data: headings }}
          githubUrl={sourceUrl}
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
