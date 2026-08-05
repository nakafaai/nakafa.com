import { PublicPathSchema } from "@nakafa/aksara-contracts/ids";
import {
  ArticleCategorySchema,
  ArticleSlugSchema,
} from "@nakafa/aksara-contracts/projection/article";
import { Schema } from "effect";
import type { Locale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { readArticleMetadata } from "@/app/[locale]/(app)/(shared)/(main)/(learn)/articles/[category]/[slug]/content";
import {
  getPublishedArticlePage,
  getPublishedCategories,
} from "@/lib/content/article/catalog";

/** Reads Open Graph copy exclusively from signed or preview article ownership. */
export async function readArticleOgMetadata(
  locale: Locale,
  slug: readonly string[]
) {
  const [root, category, articleSlug, ...remaining] = slug;
  if (root !== "articles") {
    return null;
  }

  if (!category) {
    const [, tCommon, tArticles] = await Promise.all([
      getPublishedCategories({
        cursor: null,
        expectedManifestHash: null,
        expectedReleaseId: null,
        locale,
      }),
      getTranslations({ locale, namespace: "Common" }),
      getTranslations({ locale, namespace: "Articles" }),
    ]);
    return {
      description: tArticles("description"),
      title: tCommon("articles"),
    };
  }

  if (!Schema.is(ArticleCategorySchema)(category)) {
    return null;
  }

  if (!articleSlug) {
    const [page, tArticles] = await Promise.all([
      getPublishedArticlePage({
        category,
        cursor: null,
        expectedManifestHash: null,
        expectedReleaseId: null,
        locale,
      }),
      getTranslations({ locale, namespace: "Articles" }),
    ]);
    const article = page.articles[0];
    if (!article) {
      return null;
    }
    return {
      description: tArticles("description"),
      title: article.categoryTitle,
    };
  }

  if (remaining.length > 0 || !Schema.is(ArticleSlugSchema)(articleSlug)) {
    return null;
  }

  const publicPath = PublicPathSchema.make(
    `articles/${category}/${articleSlug}`
  );
  const article = await readArticleMetadata({ locale, publicPath });
  return {
    description: article.metadata.description ?? article.metadata.title,
    title: article.metadata.title,
  };
}
