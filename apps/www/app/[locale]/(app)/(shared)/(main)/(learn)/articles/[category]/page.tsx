import {
  type ArticleCategory,
  ArticleCategorySchema,
} from "@nakafa/aksara-contracts/projection/article";
import { BreadcrumbJsonLd } from "@repo/seo/json-ld/breadcrumb";
import { CollectionPageJsonLd } from "@repo/seo/json-ld/collection-page";
import { Schema } from "effect";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { type Locale, useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { getArticleCategoryIcon } from "@/components/articles/category";
import { CardArticle } from "@/components/shared/card-article";
import { ContainerList } from "@/components/shared/container-list";
import { FooterContent } from "@/components/shared/footer-content";
import { HeaderContent } from "@/components/shared/header-content";
import { LayoutContent } from "@/components/shared/layout-content";
import { RefContent } from "@/components/shared/ref-content";
import {
  getArticleSourceDirectory,
  getPublishedArticlePage,
  selectArticleCategories,
  selectCategoryArticles,
} from "@/lib/content/articles";
import { getLocaleOrThrow } from "@/lib/i18n/params";
import { getAksaraTreeUrl } from "@/lib/utils/github";
import { getOgUrl, getSocialMetadata } from "@/lib/utils/metadata";
import { createLocalizedAlternates } from "@/lib/utils/seo/alternates";
import { createBreadcrumbItems } from "@/lib/utils/seo/breadcrumbs";

/** Validates article category params once so metadata and page rendering share the same 404 behavior. */
async function getResolvedParams(
  params: PageProps<"/[locale]/articles/[category]">["params"]
) {
  const { locale: rawLocale, category: rawCategory } = await params;
  const locale = getLocaleOrThrow(rawLocale);

  if (!Schema.is(ArticleCategorySchema)(rawCategory)) {
    notFound();
  }

  return { category: rawCategory, locale };
}

/** Builds metadata for one article category from the same validated route params as the page. */
export async function generateMetadata({
  params,
}: {
  params: PageProps<"/[locale]/articles/[category]">["params"];
}): Promise<Metadata> {
  const { locale, category } = await getResolvedParams(params);
  const t = await getTranslations({ locale, namespace: "Articles" });

  const categoryPath = `/articles/${category}`;

  const title = t(category);
  const description = t("description");
  const path = `/${locale}${categoryPath}`;
  const socialMetadata = getSocialMetadata({
    title,
    description,
    locale,
    path,
    image: getOgUrl(locale, categoryPath),
  });

  return {
    title,
    description,
    alternates: createLocalizedAlternates(path),
    ...socialMetadata,
  };
}

/** Generates localized article categories from the active Aksara catalog. */
export async function generateStaticParams({
  params,
}: {
  params: { locale: string };
}) {
  const locale = getLocaleOrThrow(params.locale);
  const catalog = await getPublishedArticlePage({ cursor: null, locale });
  return selectArticleCategories(catalog.articles).map((article) => ({
    category: article.category,
  }));
}

/** Renders one article category page after validating the localized category slug. */
export default async function Page({
  params,
}: PageProps<"/[locale]/articles/[category]">) {
  const { category, locale } = await getResolvedParams(params);
  const catalog = await getPublishedArticlePage({ cursor: null, locale });
  const articles = selectCategoryArticles(catalog.articles, category);
  const source = articles[0];
  if (!source) {
    notFound();
  }
  const categoryPath = `/${source.parentPath}`;
  const sourceUrl = source.sourceRevision
    ? getAksaraTreeUrl({
        path: getArticleSourceDirectory(source, "category"),
        revision: source.sourceRevision,
      })
    : null;

  return (
    <>
      <PageArticles
        articles={articles}
        category={category}
        categoryPath={categoryPath}
        header={<PageHeader category={category} />}
        locale={locale}
      />

      {sourceUrl ? (
        <FooterContent className="mt-0">
          <RefContent githubUrl={sourceUrl} />
        </FooterContent>
      ) : null}
    </>
  );
}

/** Renders the cached article card list plus list-level JSON-LD for one category. */
async function PageArticles({
  articles,
  locale,
  category,
  categoryPath,
  header,
}: {
  articles: ReturnType<typeof selectCategoryArticles>;
  locale: Locale;
  category: ArticleCategory;
  categoryPath: string;
  header: React.ReactNode;
}) {
  const [t, tCommon] = await Promise.all([
    getTranslations({ locale, namespace: "Articles" }),
    getTranslations({ locale, namespace: "Common" }),
  ]);

  return (
    <>
      <BreadcrumbJsonLd
        breadcrumbItems={createBreadcrumbItems(locale, [
          { name: tCommon("home"), path: "" },
          { name: tCommon("articles"), path: "/articles" },
          { name: t(category), path: categoryPath },
        ])}
      />
      <CollectionPageJsonLd
        description={t("description")}
        items={articles.map((article) => ({
          url: `https://nakafa.com/${locale}/${article.publicPath}`,
          name: article.title,
        }))}
        name={t(category)}
        url={`https://nakafa.com/${locale}${categoryPath}`}
      />

      {header}

      <LayoutContent>
        <ContainerList>
          {articles.map((article) => (
            <CardArticle article={article} key={article.slug} />
          ))}
        </ContainerList>
      </LayoutContent>
    </>
  );
}

/** Renders the category heading with the route-owned article icon. */
function PageHeader({ category }: { category: ArticleCategory }) {
  const t = useTranslations("Articles");

  return (
    <HeaderContent
      description={t("description")}
      icon={getArticleCategoryIcon(category)}
      title={t(category)}
    />
  );
}
