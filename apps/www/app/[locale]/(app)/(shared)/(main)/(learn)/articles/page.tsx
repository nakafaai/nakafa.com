import { BookOpen02Icon } from "@hugeicons/core-free-icons";
import { BreadcrumbJsonLd } from "@repo/seo/json-ld/breadcrumb";
import { Option } from "effect";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import type { Locale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { getArticleCategoryIcon } from "@/components/articles/category";
import { ArticleNext } from "@/components/articles/next";
import { FooterContent } from "@/components/shared/footer-content";
import { HeaderContent } from "@/components/shared/header-content";
import { LayoutContent } from "@/components/shared/layout-content";
import { RefContent } from "@/components/shared/ref-content";
import { SubjectItem } from "@/components/shared/subject-item";
import { SubjectList } from "@/components/shared/subject-list";
import {
  ARTICLE_SOURCE_ROOT,
  type ArticlePageCursor,
  getPublishedCategories,
} from "@/lib/content/article/catalog";
import {
  getArticleNextHref,
  readArticlePageCursor,
} from "@/lib/content/article/query";
import { getLocaleOrThrow } from "@/lib/i18n/params";
import { createLocalizedAlternates } from "@/lib/seo/alternates";
import { createBreadcrumbItems } from "@/lib/seo/breadcrumbs";
import { getAksaraTreeUrl } from "@/lib/utils/github";
import { getOgUrl, getSocialMetadata } from "@/lib/utils/metadata";

/** Builds locale-specific article index metadata from article copy. */
export async function generateMetadata({
  params,
}: {
  params: PageProps<"/[locale]/articles">["params"];
}): Promise<Metadata> {
  const locale = getLocaleOrThrow((await params).locale);
  const [tCommon, tArticles] = await Promise.all([
    getTranslations({ locale, namespace: "Common" }),
    getTranslations({ locale, namespace: "Articles" }),
  ]);

  const path = `/${locale}/articles`;
  const title = tCommon("articles");
  const description = tArticles("description");
  const socialMetadata = getSocialMetadata({
    title,
    description,
    locale,
    path,
    image: getOgUrl(locale, "/articles"),
  });

  return {
    title,
    description,
    alternates: createLocalizedAlternates(path),
    ...socialMetadata,
  };
}

/** Adapts localized route params to the article index surface. */
export default function Page({
  params,
  searchParams,
}: PageProps<"/[locale]/articles">) {
  return (
    <Suspense fallback={null}>
      <PageContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}

/** Reads request-time pagination below the route Suspense boundary. */
async function PageContent({
  params,
  searchParams,
}: PageProps<"/[locale]/articles">) {
  const [{ locale: rawLocale }, query] = await Promise.all([
    params,
    searchParams,
  ]);
  const locale = getLocaleOrThrow(rawLocale);
  const cursor = readArticlePageCursor(query ?? {});
  if (Option.isNone(cursor)) {
    notFound();
  }

  return <ArticleCatalog cursor={cursor.value} locale={locale} />;
}

/** Renders categories from the signed article catalog. */
async function ArticleCatalog({
  cursor,
  locale,
}: {
  cursor: ArticlePageCursor;
  locale: Locale;
}) {
  const [catalog, tCommon, tArticles] = await Promise.all([
    getPublishedCategories({
      ...cursor,
      locale,
    }),
    getTranslations({ locale, namespace: "Common" }),
    getTranslations({ locale, namespace: "Articles" }),
  ]);
  if (catalog.stale) {
    redirect(`/${locale}/articles`);
  }
  const nextHref = getArticleNextHref("/articles", catalog);
  const sourceUrl = catalog.sourceRevision
    ? getAksaraTreeUrl({
        path: ARTICLE_SOURCE_ROOT,
        revision: catalog.sourceRevision,
      })
    : null;

  return (
    <>
      <BreadcrumbJsonLd
        breadcrumbItems={createBreadcrumbItems(locale, [
          { name: tCommon("home"), path: "" },
          { name: tCommon("articles"), path: "/articles" },
        ])}
      />
      <HeaderContent
        description={tArticles("description")}
        icon={BookOpen02Icon}
        title={tCommon("articles")}
      />
      <LayoutContent>
        <SubjectList>
          {catalog.categories.map(({ category, route, title }) => (
            <SubjectItem
              href={`/articles/${route}`}
              icon={getArticleCategoryIcon(category)}
              key={route}
              label={title}
            />
          ))}
        </SubjectList>
      </LayoutContent>
      {nextHref ? <ArticleNext href={nextHref} /> : null}
      {sourceUrl ? (
        <FooterContent className="mt-0">
          <RefContent githubUrl={sourceUrl} />
        </FooterContent>
      ) : null}
    </>
  );
}
