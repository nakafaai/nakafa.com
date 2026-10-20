import "@tanstack/react-start/server-only";

import { PublicPathSchema } from "@nakafa/aksara-contracts/ids";
import { ArticleRouteSlugSchema } from "@nakafa/aksara-contracts/projection/article";
import { readNamespaceSegment } from "@repo/contents/route/surface";
import type { Locale } from "@repo/internationalization/src/locale";
import { readServerTranslator } from "@repo/internationalization/src/translator";
import { Array as Arr, Effect, Option, Schema } from "effect";
import { getPublishedArticleCategory } from "@/lib/content/article/category";
import { getArticleModel } from "@/lib/content/article/publication";
import { toMaterialMetadataCopy } from "@/lib/content/material/metadata";
import { getMaterialModel } from "@/lib/content/material/publication";
import { getCachedMetadataFromSlug } from "@/lib/og/metadata";

/** The title and description that one social image shows. */
const OgCopySchema = Schema.Struct({
  description: Schema.String,
  title: Schema.String,
});
type OgCopy = typeof OgCopySchema.Type;

/** A material route names its subject, topic and lesson after the namespace. */
const MATERIAL_SEGMENTS = 4;

/** Reads the articles index copy, or the copy of one article category. */
const readArticleIndexCopy = Effect.fn("www.og.copy.articleIndex")(function* (
  locale: Locale,
  category: string | undefined
) {
  const tArticles = yield* Effect.promise(() =>
    readServerTranslator({ locale, namespace: "Articles" })
  );
  if (category === undefined) {
    const tCommon = yield* Effect.promise(() =>
      readServerTranslator({ locale, namespace: "Common" })
    );
    return Option.some({
      description: tArticles("description"),
      title: tCommon("articles"),
    });
  }
  const resolved = yield* Effect.promise(() =>
    getPublishedArticleCategory(category, locale)
  );
  if (Option.isNone(resolved)) {
    return Option.none<OgCopy>();
  }
  return Option.some({
    description: tArticles("description"),
    title: resolved.value.title,
  });
});

/** Reads the copy of one signed article, or none when no published article resolves. */
const readArticleCopy = Effect.fn("www.og.copy.article")(function* (
  locale: Locale,
  slug: readonly string[]
) {
  const [, category, articleSlug, ...remaining] = slug;
  if (category === undefined) {
    return yield* readArticleIndexCopy(locale, undefined);
  }
  if (!Schema.is(ArticleRouteSlugSchema)(category)) {
    return Option.none<OgCopy>();
  }
  if (articleSlug === undefined) {
    return yield* readArticleIndexCopy(locale, category);
  }
  if (remaining.length > 0 || !Schema.is(ArticleRouteSlugSchema)(articleSlug)) {
    return Option.none<OgCopy>();
  }

  const publication = yield* Effect.promise(() =>
    getArticleModel(
      locale,
      PublicPathSchema.make(`articles/${category}/${articleSlug}`)
    )
  );
  if (!publication?.model.projection) {
    return Option.none<OgCopy>();
  }
  const { metadata } = publication.model.projection;
  return Option.some({
    description: metadata.description ?? metadata.title,
    title: metadata.title,
  });
});

/** Reads the copy of one published material lesson, or none when no lesson resolves. */
const readMaterialCopy = Effect.fn("www.og.copy.material")(function* (
  locale: Locale,
  slug: readonly string[]
) {
  const publicPath = PublicPathSchema.make(Arr.join(slug, "/"));
  const publication = yield* Effect.promise(() =>
    getMaterialModel(locale, publicPath)
  );
  if (!publication?.model.projection) {
    return Option.none<OgCopy>();
  }
  return Option.some(
    toMaterialMetadataCopy({
      metadata: publication.model.projection.metadata,
    })
  );
});

/** Reads the site's default copy for one route, which every route without content has. */
const readDefaultCopy = Effect.fn("www.og.copy.default")(function* (
  locale: Locale,
  slug: readonly string[]
) {
  const fallback = yield* Effect.promise(() =>
    getCachedMetadataFromSlug(locale, [...slug])
  );
  return Option.some({
    description: fallback.description ?? fallback.title,
    title: fallback.title,
  });
});

/**
 * Reads the copy of one social image from the content it names: an article,
 * a material lesson, or the site's default copy for every other route. A
 * route that names content with no published release answers none, so the
 * image falls back to the brand artwork instead of rendering the shell.
 */
export const readOgCopy = Effect.fn("www.og.copy.read")(function* (
  locale: Locale,
  slug: readonly string[]
) {
  if (slug[0] === "articles") {
    return yield* readArticleCopy(locale, slug);
  }
  if (
    slug[0] === readNamespaceSegment("subject", locale) &&
    slug.length >= MATERIAL_SEGMENTS
  ) {
    return yield* readMaterialCopy(locale, slug);
  }
  return yield* readDefaultCopy(locale, slug);
});
