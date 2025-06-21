import { CardArticle } from "@/components/shared/card-article";
import { ContainerList } from "@/components/shared/container-list";
import { FooterContent } from "@/components/shared/footer-content";
import { HeaderContent } from "@/components/shared/header-content";
import { LayoutContent } from "@/components/shared/layout-content";
import { RefContent } from "@/components/shared/ref-content";
import { getGithubUrl } from "@/lib/utils/github";
import { getOgUrl } from "@/lib/utils/metadata";
import { getStaticParams } from "@/lib/utils/system";
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

export const revalidate = false;

type Props = {
  params: Promise<{ locale: Locale; category: ArticleCategory }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, category } = await params;
  const t = await getTranslations("Articles");

  const FILE_PATH = getCategoryPath(category);

  const image = {
    url: getOgUrl(locale, FILE_PATH),
    width: 1200,
    height: 630,
  };

  return {
    title: t(category),
    description: t("description"),
    alternates: {
      canonical: `/${locale}${FILE_PATH}`,
    },
    openGraph: {
      url: `/${locale}${FILE_PATH}`,
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

  const FILE_PATH = getCategoryPath(category);

  // Statically get all articles
  const articles = await getArticles(category, locale);

  return (
    <>
      <BreadcrumbJsonLd
        locale={locale}
        breadcrumbItems={articles.map((article, index) => ({
          "@type": "ListItem",
          "@id": `https://nakafa.com/${locale}${FILE_PATH}/${article.slug}`,
          position: index + 1,
          name: article.title,
          item: `https://nakafa.com/${locale}${FILE_PATH}/${article.slug}`,
        }))}
      />
      <HeaderContent
        title={t(category)}
        description={t("description")}
        icon={getCategoryIcon(category)}
      />
      <LayoutContent scrollIndicator={false} className="py-10">
        <ContainerList>
          {articles.map((article) => (
            <CardArticle
              key={article.slug}
              category={category}
              article={article}
            />
          ))}
        </ContainerList>
      </LayoutContent>
      <FooterContent className="mt-0">
        <RefContent
          githubUrl={getGithubUrl({ path: `/contents${FILE_PATH}` })}
        />
      </FooterContent>
    </>
  );
}
