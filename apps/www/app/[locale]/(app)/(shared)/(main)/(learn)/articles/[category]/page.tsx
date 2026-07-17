import {
  getCategoryPath,
  parseArticleCategory,
} from "@repo/contents/_lib/articles/category";
import { getCategoryIcon } from "@repo/contents/_lib/articles/icons";
import type { ArticleCategory } from "@repo/contents/_types/taxonomy";
import { BreadcrumbJsonLd } from "@repo/seo/json-ld/breadcrumb";
import { CollectionPageJsonLd } from "@repo/seo/json-ld/collection-page";
import { Effect, Option } from "effect";
import type { Metadata } from "next";
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
import { getRuntimeArticleSummaries } from "@/lib/content/articles";
import { applyContentRuntimeCache } from "@/lib/content/cache";
import { getLocaleOrThrow } from "@/lib/i18n/params";
import { getGithubUrl } from "@/lib/utils/github";
import { getOgUrl, getSocialMetadata } from "@/lib/utils/metadata";
import { createLocalizedAlternates } from "@/lib/utils/seo/alternates";
import { createBreadcrumbItems } from "@/lib/utils/seo/breadcrumbs";
import { getStaticParams } from "@/lib/utils/system";

/** Validates article category params once so metadata and page rendering share the same 404 behavior. */
async function getResolvedParams(
  params: PageProps<"/[locale]/articles/[category]">["params"]
) {
  const { locale: rawLocale, category: rawCategory } = await params;
  const locale = getLocaleOrThrow(rawLocale);
  const parsedCategory = parseArticleCategory(rawCategory);

  if (Option.isNone(parsedCategory)) {
    notFound();
  }

  const category = parsedCategory.value;

  return { category, locale };
}

/** Reads the cached Convex-backed article cards for one category page. */
async function getCategoryArticles(category: ArticleCategory, locale: Locale) {
  "use cache";

  applyContentRuntimeCache();

  return Effect.runPromise(getRuntimeArticleSummaries(category, locale));
}

/** Builds metadata for one article category from the same validated route params as the page. */
export async function generateMetadata({
  params,
}: {
  params: PageProps<"/[locale]/articles/[category]">["params"];
}): Promise<Metadata> {
  const { locale, category } = await getResolvedParams(params);
  const t = await getTranslations({ locale, namespace: "Articles" });

  const FilePath = getCategoryPath(category);

  const title = t(category);
  const description = t("description");
  const path = `/${locale}${FilePath}`;
  const socialMetadata = getSocialMetadata({
    title,
    description,
    locale,
    path,
    image: getOgUrl(locale, FilePath),
  });

  return {
    title,
    description,
    alternates: createLocalizedAlternates(path),
    ...socialMetadata,
  };
}

/** Generates localized article category paths from the system route catalog. */
export function generateStaticParams({
  params,
}: {
  params: { locale: string };
}) {
  return getStaticParams({
    basePath: "articles",
    locale: getLocaleOrThrow(params.locale),
    paramNames: ["category"],
  });
}

/** Renders one article category page after validating the localized category slug. */
export default function Page(
  props: PageProps<"/[locale]/articles/[category]">
) {
  const { params } = props;
  const { locale: rawLocale, category: rawCategory } = use(params);
  const locale = getLocaleOrThrow(rawLocale);
  const parsedCategory = parseArticleCategory(rawCategory);

  if (Option.isNone(parsedCategory)) {
    notFound();
  }

  const category = parsedCategory.value;
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

/** Renders the cached article card list plus list-level JSON-LD for one category. */
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
  const [articles, t, tCommon] = await Promise.all([
    getCategoryArticles(category, locale),
    getTranslations({ locale, namespace: "Articles" }),
    getTranslations({ locale, namespace: "Common" }),
  ]);

  return (
    <>
      <BreadcrumbJsonLd
        breadcrumbItems={createBreadcrumbItems(locale, [
          { name: tCommon("home"), path: "" },
          { name: tCommon("articles"), path: "/articles" },
          { name: t(category), path: FilePath },
        ])}
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

/** Renders the category heading with the source-owned article icon. */
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
