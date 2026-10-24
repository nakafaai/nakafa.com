import { PublicPathSchema } from "@nakafa/aksara-contracts/ids";
import { ArticleRouteSlugSchema } from "@nakafa/aksara-contracts/projection/article";
import contentRelease from "@repo/backend/confect/_generated/refs/contentRelease";
import { resolveReferenceInput } from "@repo/backend/confect/contentRelease/reference/input";
import { readNamespaceSegment } from "@repo/contents/route/surface";
import type { Locale } from "@repo/internationalization/src/locale";
import { Array as Arr, Effect, Option, Schema } from "effect";
import { readPublishedArticleCategory } from "@/lib/content/article/category";
import { getArticleModel } from "@/lib/content/article/publication";
import { toMaterialMetadataCopy } from "@/lib/content/material/metadata";
import { getMaterialModel } from "@/lib/content/material/model";
import { queryContentStore } from "@/lib/content/store/query";
import { readCopy } from "@/lib/i18n/copy.server";
import { getMetadataFromSlug } from "@/lib/og/metadata";

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
  const tArticles = yield* readCopy({ locale, namespace: "Articles" });
  if (category === undefined) {
    const tCommon = yield* readCopy({ locale, namespace: "Common" });
    return Option.some({
      description: tArticles("description"),
      title: tCommon("articles"),
    });
  }
  const resolved = yield* readPublishedArticleCategory(category, locale);
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

  const publication = yield* getArticleModel(
    locale,
    PublicPathSchema.make(`articles/${category}/${articleSlug}`)
  );
  if (Option.isNone(publication) || !publication.value.model.projection) {
    return Option.none<OgCopy>();
  }
  const { metadata } = publication.value.model.projection;
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
  const publication = yield* getMaterialModel(locale, publicPath);
  if (Option.isNone(publication) || !publication.value.model.projection) {
    return Option.none<OgCopy>();
  }
  return Option.some(
    toMaterialMetadataCopy({
      metadata: publication.value.model.projection.metadata,
    })
  );
});

/** Reads the site's default copy for one route. */
const readDefaultCopy = Effect.fn("www.og.copy.default")(function* (
  locale: Locale,
  slug: readonly string[]
) {
  const fallback = yield* getMetadataFromSlug(locale, [...slug]);
  return {
    description: fallback.description ?? fallback.title,
    title: fallback.title,
  };
});

/**
 * Reads the copy of a route that names no article or lesson. The release
 * decides first, through the same reference that the page reads: a route
 * that the reference resolves answers the site's copy only when the release
 * lists it, and a route outside the content namespaces answers the site's
 * copy at once.
 */
const readRouteCopy = Effect.fn("www.og.copy.route")(function* (
  locale: Locale,
  slug: readonly string[]
) {
  const publicPath = Arr.join(slug, "/");
  const input = yield* resolveReferenceInput({
    appLocale: locale,
    kind: "route",
    publicPath,
  });
  if (input) {
    const reference = yield* queryContentStore(contentRelease.reference.read, {
      input: { appLocale: locale, kind: "route", publicPath },
    });
    if (!reference) {
      return Option.none<OgCopy>();
    }
  }
  return Option.some(yield* readDefaultCopy(locale, slug));
});

/**
 * Reads the copy of one social image from the content it names: an article or
 * a material lesson, or the site's copy for a route that the release lists. A
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
  return yield* readRouteCopy(locale, slug);
});
