import {
  getCategoryIcon,
  getCategoryPath,
} from "@repo/contents/_lib/articles/category";
import { getArticles } from "@repo/contents/_lib/articles/slug";
import type { ArticleCategory } from "@repo/contents/_types/articles/category";
import { BreadcrumbJsonLd } from "@repo/seo/json-ld/breadcrumb";
import type { Metadata } from "next";
import { type Locale, useTranslations } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { use } from "react";
import { CardArticle } from "@/components/shared/card-article";
import { ContainerList } from "@/components/shared/container-list";
import { FooterContent } from "@/components/shared/footer-content";
import { HeaderContent } from "@/components/shared/header-content";
import { RefContent } from "@/components/shared/ref-content";
import { getGithubUrl } from "@/lib/utils/github";
import { getOgUrl } from "@/lib/utils/metadata";
import { getStaticParams } from "@/lib/utils/system";

type Props = {
  params: Promise<{ locale: Locale; category: ArticleCategory }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, category } = await params;
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

export default function Page({ params }: Props) {
  const { locale, category } = use(params);

  // Enable static rendering
  setRequestLocale(locale);

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

      {header}

      <ContainerList>
        {articles.map((article) => (
          <CardArticle
            article={article}
            category={category}
            key={article.slug}
          />
        ))}
      </ContainerList>
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
