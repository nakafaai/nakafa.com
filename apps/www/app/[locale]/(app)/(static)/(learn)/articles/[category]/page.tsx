import {
  getCategoryIcon,
  getCategoryPath,
  parseArticleCategory,
} from "@repo/contents/_lib/articles/category";
import { getArticleSummaries } from "@repo/contents/_lib/articles/slug";
import type { ArticleCategory } from "@repo/contents/_types/articles/category";
import { BreadcrumbJsonLd } from "@repo/seo/json-ld/breadcrumb";
import { CollectionPageJsonLd } from "@repo/seo/json-ld/collection-page";
import type { Metadata } from "next";
import { cacheLife } from "next/cache";
import { notFound } from "next/navigation";
import { type Locale, useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { use } from "react";
import { CardArticle } from "@/components/shared/card-article";
import { ContainerList } from "@/components/shared/container-list";
import { FooterContent } from "@/components/shared/footer-content";
import { HeaderContent } from "@/components/shared/header-content";
import { LayoutContent } from "@/components/shared/layout-content";
import { RefContent } from "@/components/shared/ref-content";
import { getLocaleOrThrow } from "@/lib/i18n/params";
import { getGithubUrl } from "@/lib/utils/github";
import { getOgUrl } from "@/lib/utils/metadata";
import { getStaticParams } from "@/lib/utils/system";

async function getResolvedParams(
  params: PageProps<"/[locale]/articles/[category]">["params"]
) {
  const { locale: rawLocale, category: rawCategory } = await params;
  const locale = getLocaleOrThrow(rawLocale);
  const category = parseArticleCategory(rawCategory);

  if (!category) {
    notFound();
  }

  return { category, locale };
}

async function getCategoryArticles(category: ArticleCategory, locale: Locale) {
  "use cache";

  cacheLife("max");

  return getArticleSummaries(category, locale);
}

export async function generateMetadata({
  params,
}: {
  params: PageProps<"/[locale]/articles/[category]">["params"];
}): Promise<Metadata> {
  const { locale, category } = await getResolvedParams(params);
  const t = await getTranslations({ locale, namespace: "Articles" });

  const FilePath = getCategoryPath(category);

  const image = {
    url: getOgUrl(locale, FilePath),
    width: 1200,
    height: 630,
  };

  return {
    title: t(category),
    description: t("description"),
    alternates: {
      canonical: `/${locale}${FilePath}`,
    },
    openGraph: {
      title: t(category),
      description: t("description"),
      url: `/${locale}${FilePath}`,
      siteName: "Nakafa",
      locale,
      type: "website",
      images: [image],
    },
  };
}

// Generate bottom-up static params
export function generateStaticParams() {
  return getStaticParams({
    basePath: "articles",
    paramNames: ["category"],
  });
}

export default function Page(
  props: PageProps<"/[locale]/articles/[category]">
) {
  const { params } = props;
  const { locale: rawLocale, category: rawCategory } = use(params);
  const locale = getLocaleOrThrow(rawLocale);
  const category = parseArticleCategory(rawCategory);

  if (!category) {
    notFound();
  }

  const FilePath = getCategoryPath(category);

  return (
    <>
      <PageArticles
        category={category}
        FilePath={FilePath}
        header={<PageHeader category={category} />}
        locale={locale}
      />

      <FooterContent className="mt-0">
        <RefContent
          githubUrl={getGithubUrl({ path: `/packages/contents${FilePath}` })}
        />
      </FooterContent>
    </>
  );
}

async function PageArticles({
  locale,
  category,
  FilePath,
  header,
}: {
  locale: Locale;
  category: ArticleCategory;
  FilePath: string;
  header: React.ReactNode;
}) {
  const articles = await getCategoryArticles(category, locale);
  const t = await getTranslations({ locale, namespace: "Articles" });

  return (
    <>
      <BreadcrumbJsonLd
        breadcrumbItems={articles.map((article, index) => ({
          "@type": "ListItem",
          "@id": `https://nakafa.com/${locale}${FilePath}/${article.slug}`,
          position: index + 1,
          name: article.title,
          item: `https://nakafa.com/${locale}${FilePath}/${article.slug}`,
        }))}
      />
      <CollectionPageJsonLd
        description={t("description")}
        items={articles.map((article) => ({
          url: `https://nakafa.com/${locale}${FilePath}/${article.slug}`,
          name: article.title,
        }))}
        name={t(category)}
        url={`https://nakafa.com/${locale}${FilePath}`}
      />

      {header}

      <LayoutContent>
        <ContainerList>
          {articles.map((article) => (
            <CardArticle
              article={article}
              category={category}
              key={article.slug}
            />
          ))}
        </ContainerList>
      </LayoutContent>
    </>
  );
}

function PageHeader({ category }: { category: ArticleCategory }) {
  const t = useTranslations("Articles");

  return (
    <HeaderContent
      description={t("description")}
      icon={getCategoryIcon(category)}
      title={t(category)}
    />
  );
}
