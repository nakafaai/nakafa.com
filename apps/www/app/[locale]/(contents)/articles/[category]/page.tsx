import {
  getCategoryIcon,
  getCategoryPath,
} from "@repo/contents/_lib/articles/category";
import { getArticles } from "@repo/contents/_lib/articles/slug";
import type { ArticleCategory } from "@repo/contents/_types/articles/category";
import { BreadcrumbJsonLd } from "@repo/seo/json-ld/breadcrumb";
import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CardArticle } from "@/components/shared/card-article";
import { ContainerList } from "@/components/shared/container-list";
import { FooterContent } from "@/components/shared/footer-content";
import { HeaderContent } from "@/components/shared/header-content";
import { LayoutContent } from "@/components/shared/layout-content";
import { RefContent } from "@/components/shared/ref-content";
import { getGithubUrl } from "@/lib/utils/github";
import { getOgUrl } from "@/lib/utils/metadata";
import { getStaticParams } from "@/lib/utils/system";

export const revalidate = false;

type Props = {
  params: Promise<{ locale: Locale; category: ArticleCategory }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, category } = await params;
  const t = await getTranslations("Articles");

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
      url: `/${locale}${FilePath}`,
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

export default async function Page({ params }: Props) {
  const { locale, category } = await params;

  const t = await getTranslations("Articles");

  // Enable static rendering
  setRequestLocale(locale);

  const FilePath = getCategoryPath(category);

  // Statically get all articles
  const articles = await getArticles(category, locale);

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
        locale={locale}
      />
      <HeaderContent
        description={t("description")}
        icon={getCategoryIcon(category)}
        title={t(category)}
      />
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
      <FooterContent className="mt-0">
        <RefContent
          githubUrl={getGithubUrl({ path: `/packages/contents${FilePath}` })}
        />
      </FooterContent>
    </>
  );
}
