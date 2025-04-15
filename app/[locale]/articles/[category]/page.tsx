import { CardArticle } from "@/components/shared/card-article";
import { ContainerList } from "@/components/shared/container-list";
import { FooterContent } from "@/components/shared/footer-content";
import { HeaderContent } from "@/components/shared/header-content";
import { LayoutContent } from "@/components/shared/layout-content";
import { RefContent } from "@/components/shared/ref-content";
import {
  getCategoryIcon,
  getCategoryPath,
} from "@/lib/utils/articles/category";
import { getGithubUrl } from "@/lib/utils/github";
import { getArticles } from "@/lib/utils/markdown";
import { getFolderChildNames } from "@/lib/utils/system";
import type { ArticleCategory } from "@/types/articles/category";
import type { Metadata } from "next";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";

type Props = {
  params: Promise<{ locale: Locale; category: ArticleCategory }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, category } = await params;
  const t = await getTranslations("Articles");

  return {
    title: t(category),
    description: t("description"),
    alternates: {
      canonical: `/${locale}/articles/${category}`,
    },
  };
}

// Generate bottom-up static params
export function generateStaticParams() {
  const categories = getFolderChildNames("contents/articles");
  return categories.map((category) => ({ category }));
}

export default async function Page({ params }: Props) {
  const { locale, category } = await params;

  const t = await getTranslations("Articles");

  // Enable static rendering
  setRequestLocale(locale);

  const categoryPath = getCategoryPath(category);

  // Statically get all articles
  const articles = await getArticles(category, locale);

  return (
    <>
      <HeaderContent
        title={t(category)}
        description={t("description")}
        icon={getCategoryIcon(category)}
      />
      <LayoutContent className="py-10">
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
        <RefContent githubUrl={getGithubUrl(categoryPath)} />
      </FooterContent>
    </>
  );
}
