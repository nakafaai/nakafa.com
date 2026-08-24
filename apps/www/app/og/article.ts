import { PublicPathSchema } from "@nakafa/aksara-contracts/ids";
import { ArticleRouteSlugSchema } from "@nakafa/aksara-contracts/projection/article";
import { Schema } from "effect";
import type { Locale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { readArticleMetadata } from "@/app/[locale]/(app)/(shared)/(main)/(learn)/articles/[category]/[slug]/content";
import { getPublishedCategories } from "@/lib/content/article/catalog";
import { getPublishedArticleCategory } from "@/lib/content/article/category";

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

  if (!Schema.is(ArticleRouteSlugSchema)(category)) {
    return null;
  }

  if (!articleSlug) {
    const resolved = await getPublishedArticleCategory(category, locale);
    if (!resolved) {
      return null;
    }
    const tArticles = await getTranslations({ locale, namespace: "Articles" });
    return {
      description: tArticles("description"),
      title: resolved.title,
    };
  }

  if (remaining.length > 0 || !Schema.is(ArticleRouteSlugSchema)(articleSlug)) {
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
