import {
  type ArticleCategory,
  ArticleCategorySchema,
} from "@nakafa/aksara-contracts/projection/article";
import { getHeadings } from "@repo/contents/_lib/toc";
import { ArticleJsonLd } from "@repo/seo/json-ld/article";
import { BreadcrumbJsonLd } from "@repo/seo/json-ld/breadcrumb";
import { LearningResourceJsonLd } from "@repo/seo/json-ld/learning-resource";
import { Schema } from "effect";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { Locale } from "next-intl";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { DeferredAiSheetOpen } from "@/components/ai/deferred-sheet-open";
import { DeferredComments } from "@/components/comments/deferred";
import { ComingSoon } from "@/components/shared/coming-soon";
import { FooterContent } from "@/components/shared/footer-content";
import { HeaderContent } from "@/components/shared/header-content";
import { LayoutContent } from "@/components/shared/layout-content";
import { LayoutMaterialContent } from "@/components/shared/material/content";
import { LayoutMaterial } from "@/components/shared/material/layout";
import { LayoutMaterialToc } from "@/components/shared/material/toc";
import { getPublishedArticlePage } from "@/lib/content/articles";
import {
  getPublishedArticle,
  type PublishedArticleContent,
  renderPublishedArticle,
} from "@/lib/content/published/article";
import { getLocaleOrThrow } from "@/lib/i18n/params";
import { getAksaraUrl } from "@/lib/utils/github";
import { getOgUrl, getSocialMetadata } from "@/lib/utils/metadata";
import { createLocalizedAlternates } from "@/lib/utils/seo/alternates";
import { createBreadcrumbItems } from "@/lib/utils/seo/breadcrumbs";
import { generateSEOMetadata } from "@/lib/utils/seo/generator";
import type { SEOContext } from "@/lib/utils/seo/types";

type ArrayItem<T> = T extends readonly (infer Item)[] ? Item : T;
type ArticleJsonLdAuthor = ArrayItem<
  Parameters<typeof ArticleJsonLd>[0]["author"]
>;

/** Validates localized article route params before metadata and rendering touch content modules. */
async function getResolvedParams(
  params: PageProps<"/[locale]/articles/[category]/[slug]">["params"]
) {
  const { locale: rawLocale, category: rawCategory, slug } = await params;
  const locale = getLocaleOrThrow(rawLocale);

  if (!Schema.is(ArticleCategorySchema)(rawCategory)) {
    notFound();
  }
  const publicPath = `articles/${rawCategory}/${slug}`;
  return { category: rawCategory, locale, publicPath, slug };
}

/** Builds article metadata from the projected article route and runtime content row. */
export async function generateMetadata({
  params,
}: {
  params: PageProps<"/[locale]/articles/[category]/[slug]">["params"];
}): Promise<Metadata> {
  const { locale, category, publicPath } = await getResolvedParams(params);
  const [t, article] = await Promise.all([
    getTranslations({ locale, namespace: "Articles" }),
    getPublishedArticle({
      locale,
      publicPath,
    }),
  ]);
  const filePath = `/${publicPath}`;
  const path = `/${locale}${filePath}`;
  const alternates = createLocalizedAlternates(path, {
    types: {
      "text/markdown": `${path}.md`,
    },
  });
  const { metadata } = article.projection;

  // Evidence: Use ICU-based SEO generator for type-safe, locale-aware metadata
  // Source: https://developers.google.com/search/docs/appearance/title-link
  const seoContext: SEOContext = {
    type: "article",
    category,
    data: {
      title: metadata.title,
      description: metadata.description,
      subject: undefined,
    },
  };

  const { title, description, keywords } = await generateSEOMetadata(
    seoContext,
    locale
  );
  const socialMetadata = getSocialMetadata({
    title,
    description,
    locale,
    path,
    image: getOgUrl(locale, filePath),
    type: "article",
  });

  return {
    title: { absolute: title },
    description,
    alternates,
    authors: metadata.authors.map(({ name }) => ({ name })),
    category: t(category),
    keywords,
    ...socialMetadata,
  };
}

/** Prebuilds article pages from the active Aksara article catalog. */
export async function generateStaticParams({
  params,
}: {
  params: { locale: string };
}) {
  const locale = getLocaleOrThrow(params.locale);
  const catalog = await getPublishedArticlePage({ cursor: null, locale });
  return catalog.articles.map((article) => ({
    category: article.category,
    slug: article.slug,
  }));
}

/** Renders an article after Convex confirms the published route exists. */
export default async function Page({
  params,
}: PageProps<"/[locale]/articles/[category]/[slug]">) {
  const { locale, category, publicPath } = await getResolvedParams(params);
  const article = await renderPublishedArticle({
    locale,
    publicPath,
  });
  const filePath = `/${publicPath}`;
  const contentMetadata = article.metadata;

  const [tCommon, tArticles] = await Promise.all([
    getTranslations("Common"),
    getTranslations("Articles"),
  ]);
  const publishedAt = new Date(
    `${contentMetadata.date}T00:00:00.000Z`
  ).toISOString();
  const authorJsonLd: ArticleJsonLdAuthor[] = contentMetadata.authors.map(
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
          { name: tCommon("articles"), path: "/articles" },
          { name: tArticles(category), path: `/articles/${category}` },
          { name: contentMetadata.title, path: filePath },
        ])}
      />
      <ArticleJsonLd
        author={authorJsonLd}
        datePublished={publishedAt}
        description={contentMetadata.description ?? ""}
        headline={contentMetadata.title}
        image={getOgUrl(locale, filePath)}
        url={`/${locale}${filePath}`}
      />
      <LearningResourceJsonLd
        author={authorJsonLd}
        datePublished={publishedAt}
        description={contentMetadata.description ?? ""}
        educationalLevel={tArticles(category)}
        name={contentMetadata.title}
      />
      <ArticleShell
        category={category}
        content={article}
        filePath={filePath}
        footer={
          <DeferredComments key={`comments:${filePath}`} slug={filePath} />
        }
        locale={locale}
        toolbar={
          <DeferredAiSheetOpen
            audio={{
              locale,
              slug: filePath,
              contentType: "article",
            }}
            contextTitle={contentMetadata.title}
            key={`audio:${filePath}`}
          />
        }
      >
        {article.body}
      </ArticleShell>
    </>
  );
}

/** Wraps the imported rich MDX article body in the material layout. */
async function ArticleShell({
  locale,
  category,
  filePath,
  content,
  children,
  footer,
  toolbar,
}: {
  locale: Locale;
  category: ArticleCategory;
  filePath: string;
  content: PublishedArticleContent;
  children: ReactNode;
  footer: ReactNode;
  toolbar: ReactNode;
}) {
  const [tCommon, tArticles] = await Promise.all([
    getTranslations("Common"),
    getTranslations("Articles"),
  ]);
  const metadata = content.metadata;
  const raw = content.rawMdx;
  const headings = getHeadings(raw);
  const sourceUrl = content.sourceRevision
    ? getAksaraUrl({
        path: content.sourcePath,
        revision: content.sourceRevision,
      })
    : null;

  return (
    <LayoutMaterial>
      <LayoutMaterialContent>
        <HeaderContent
          content={raw}
          description={metadata.description}
          link={{
            href: `/articles/${category}`,
            label: tArticles(category),
          }}
          slug={`/${locale}${filePath}`}
          sourceUrl={sourceUrl}
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
        githubUrl={sourceUrl ?? undefined}
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
