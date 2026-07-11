import { parseArticleCategory } from "@repo/contents/_lib/articles/category";
import { getHeadings } from "@repo/contents/_lib/toc";
import { formatContentDateISO } from "@repo/contents/_shared/date";
import type { ArticleCategory } from "@repo/contents/_types/taxonomy";
import { ArticleJsonLd } from "@repo/seo/json-ld/article";
import { BreadcrumbJsonLd } from "@repo/seo/json-ld/breadcrumb";
import { LearningResourceJsonLd } from "@repo/seo/json-ld/learning-resource";
import { Option } from "effect";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { Locale } from "next-intl";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { getArticlePageData } from "@/app/[locale]/(app)/(shared)/(main)/(learn)/articles/[category]/[slug]/runtime";
import { DeferredAiSheetOpen } from "@/components/ai/deferred-sheet-open";
import { DeferredComments } from "@/components/comments/deferred";
import { ComingSoon } from "@/components/shared/coming-soon";
import { FooterContent } from "@/components/shared/footer-content";
import { HeaderContent } from "@/components/shared/header-content";
import { LayoutContent } from "@/components/shared/layout-content";
import { LayoutMaterialContent } from "@/components/shared/material/content";
import { LayoutMaterial } from "@/components/shared/material/layout";
import { LayoutMaterialToc } from "@/components/shared/material/toc";
import { importContentModuleOrNull } from "@/lib/content/module";
import { getLocaleOrThrow } from "@/lib/i18n/params";
import { getGithubUrl } from "@/lib/utils/github";
import { getOgUrl, getSocialMetadata } from "@/lib/utils/metadata";
import { createLocalizedAlternates } from "@/lib/utils/seo/alternates";
import { createBreadcrumbItems } from "@/lib/utils/seo/breadcrumbs";
import { generateSEOMetadata } from "@/lib/utils/seo/generator";
import type { SEOContext } from "@/lib/utils/seo/types";
import { getStaticParams } from "@/lib/utils/system";

/** Extracts one array item type from JSON-LD props without duplicating the schema. */
type ArrayItem<T> = T extends readonly (infer Item)[] ? Item : T;

/** Author object shape accepted by the Article JSON-LD component. */
type ArticleJsonLdAuthor = ArrayItem<
  Parameters<typeof ArticleJsonLd>[0]["author"]
>;

/** Validates localized article route params before metadata and rendering touch content modules. */
async function getResolvedParams(
  params: PageProps<"/[locale]/articles/[category]/[slug]">["params"]
) {
  const { locale: rawLocale, category: rawCategory, slug } = await params;
  const locale = getLocaleOrThrow(rawLocale);
  const parsedCategory = parseArticleCategory(rawCategory);

  if (Option.isNone(parsedCategory)) {
    notFound();
  }

  const category = parsedCategory.value;

  return { category, locale, slug };
}

/** Builds article metadata from the projected article route and runtime content row. */
export async function generateMetadata({
  params,
}: {
  params: PageProps<"/[locale]/articles/[category]/[slug]">["params"];
}): Promise<Metadata> {
  const { locale, category, slug } = await getResolvedParams(params);
  const [t, { content, filePath }] = await Promise.all([
    getTranslations({ locale, namespace: "Articles" }),
    getArticlePageData({
      locale,
      category,
      slug,
    }),
  ]);

  if (!content) {
    notFound();
  }

  const path = `/${locale}${filePath}`;
  const alternates = createLocalizedAlternates(path, {
    types: {
      "text/markdown": `${path}.md`,
    },
  });
  const { metadata } = content;

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
    authors: metadata.authors,
    category: t(category),
    keywords,
    ...socialMetadata,
  };
}

/** Non-null runtime article row after metadata/page lookup has passed the 404 guard. */
type ArticleRuntimePage = NonNullable<
  Awaited<ReturnType<typeof getArticlePageData>>["content"]
>;

/** Prebuilds article pages from the runtime route catalog instead of filesystem-only slugs. */
export function generateStaticParams() {
  return getStaticParams({
    basePath: "articles",
    paramNames: ["category", "slug"],
  });
}

/** Renders an article after Convex confirms the published route exists. */
export default async function Page({
  params,
}: PageProps<"/[locale]/articles/[category]/[slug]">) {
  const { locale, category, slug } = await getResolvedParams(params);
  const { content: article, filePath } = await getArticlePageData({
    category,
    locale,
    slug,
  });

  if (!article) {
    notFound();
  }

  const content = await importContentModuleOrNull({
    filePath,
    locale,
    source: "article-content-module",
  });

  if (!content?.default) {
    notFound();
  }

  const Content = content.default;
  const contentMetadata = article.metadata;

  const [tCommon, tArticles] = await Promise.all([
    getTranslations("Common"),
    getTranslations("Articles"),
  ]);
  const publishedAt = Option.getOrElse(
    formatContentDateISO(contentMetadata.date),
    () => contentMetadata.date
  );
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
        <Content />
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
  content: ArticleRuntimePage;
  children: ReactNode;
  footer: ReactNode;
  toolbar: ReactNode;
}) {
  const [tCommon, tArticles] = await Promise.all([
    getTranslations("Common"),
    getTranslations("Articles"),
  ]);
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
            label: tArticles(category),
          }}
          slug={`/${locale}${filePath}`}
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
        githubUrl={getGithubUrl({
          path: `/packages/contents${filePath}`,
        })}
        header={{
          title: metadata.title,
          href: filePath,
          description: metadata.description,
        }}
        references={{
          title: metadata.title,
          data: content.references,
        }}
        showComments
      />
    </LayoutMaterial>
  );
}
