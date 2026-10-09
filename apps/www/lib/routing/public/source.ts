import type { ContentFamily } from "@nakafa/aksara-contracts/content";
import { PublicPathSchema } from "@nakafa/aksara-contracts/ids";
import { AppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import { ArticleRouteSlugSchema } from "@nakafa/aksara-contracts/projection/article";
import { PUBLIC_ROUTE_SURFACES } from "@repo/contents/route/surface";
import { routing } from "@repo/internationalization/src/routing";
import { Array as Arr, Effect, HashSet, Record as Rec, Schema } from "effect";
import { hasLocale } from "next-intl";
import { hasPublishedArticleCategory } from "@/lib/content/article/category";
import { matchesPreviewRoute } from "@/lib/content/preview/route";
import { readActiveContentRoute } from "@/lib/content/published/route";
import {
  isApplicationRoutePath,
  isApplicationRouteRoot,
} from "@/lib/ownership/route";

const REJECTED_PUBLIC_ROOTS = HashSet.make("/learn");
const MARKDOWN_EXTENSION_PATTERN = /\.mdx?$/;
const QURAN_SURAH_COUNT = 114;

/**
 * Reads route rejections that must run before markdown negotiation.
 *
 * Wrong public namespaces and finite public HTML routes should return a
 * real 404, but markdown requests still need a chance to route through the
 * agent-readable source handler before projected route membership is checked.
 */
export const readSourceBackedHtmlRouteRejection = Effect.fn(
  "www.routing.publicHtml.sourceRejection"
)(function* ({ method, pathname }: { method: string; pathname: string }) {
  const rejectedPublicRouteLocale = readRejectedPublicRouteLocale(pathname);

  if (rejectedPublicRouteLocale) {
    return rejectedPublicRouteLocale;
  }

  return yield* readMissingHtmlRouteLocale({ method, pathname });
});

/**
 * Rejects known public-route namespaces when a request uses a stale slug.
 *
 * This is a clean cutover check: known non-canonical namespaces become 404s
 * instead of being treated as localized pages.
 */
function readRejectedPublicRouteLocale(pathname: string) {
  if (HashSet.has(REJECTED_PUBLIC_ROOTS, pathname)) {
    return routing.defaultLocale;
  }

  const [locale, namespace] = Arr.filter(pathname.split("/"), Boolean);

  if (!(namespace && hasLocale(routing.locales, locale))) {
    return null;
  }

  const usesRejectedNamespace = Arr.some(PUBLIC_ROUTE_SURFACES, (surface) => {
    const expectedNamespace = surface.routeSlugs[locale];
    const knownNamespaces = [
      surface.appSegment,
      surface.key,
      ...Rec.values(surface.routeSlugs),
    ];

    return (
      namespace !== expectedNamespace &&
      Arr.some(
        knownNamespaces,
        (knownNamespace) => knownNamespace === namespace
      )
    );
  });

  return usesRejectedNamespace ? locale : null;
}

/**
 * Reads finite public HTML routes that should 404 before app rendering.
 *
 * Quran, signed Article, and signed Page routes have finite inventories.
 * Rejecting impossible shapes here prevents Next streamed not-found responses
 * from looking like successful soft 404s to agents and crawlers.
 */
function readMissingHtmlRouteLocale({
  method,
  pathname,
}: {
  method: string;
  pathname: string;
}) {
  if (!(method === "GET" || method === "HEAD")) {
    return Effect.succeed(null);
  }

  const [locale, root, ...segments] = Arr.filter(pathname.split("/"), Boolean);

  if (!(root && hasLocale(routing.locales, locale))) {
    return Effect.succeed(null);
  }

  if (MARKDOWN_EXTENSION_PATTERN.test(pathname)) {
    return Effect.succeed(null);
  }

  if (root === "quran") {
    return Effect.succeed(isRenderableQuranPath(segments) ? null : locale);
  }

  if (root === "articles") {
    return readMissingArticleHtmlLocale({
      locale,
      segments,
    });
  }

  if (isApplicationRouteRoot(locale, root)) {
    const publicPath = Arr.join([root, ...segments], "/");
    return Effect.succeed(
      isApplicationRoutePath(locale, publicPath) ? null : locale
    );
  }

  const publicPath = Arr.join([root, ...segments], "/");
  if (!Schema.is(PublicPathSchema)(publicPath)) {
    return Effect.succeed(locale);
  }

  return readMissingOwnedHtmlLocale({
    family: "page",
    locale,
    publicPath,
  });
}

/** Checks whether one Quran route path can be rendered. */
function isRenderableQuranPath(segments: readonly string[]) {
  if (segments.length === 0) {
    return true;
  }

  if (segments.length !== 1) {
    return false;
  }

  const surah = Arr.join(segments, "");
  const surahNumber = Number.parseInt(surah, 10);

  return (
    Number.isSafeInteger(surahNumber) &&
    `${surahNumber}` === surah &&
    surahNumber >= 1 &&
    surahNumber <= QURAN_SURAH_COUNT
  );
}

/** Verifies article paths against preview or signed publication ownership. */
function readMissingArticleHtmlLocale({
  locale,
  segments,
}: {
  locale: (typeof routing.locales)[number];
  segments: readonly string[];
}) {
  if (segments.length === 0) {
    return Effect.succeed(null);
  }

  const [category, slug] = segments;
  if (!Schema.is(ArticleRouteSlugSchema)(category)) {
    return Effect.succeed(locale);
  }

  if (segments.length === 1) {
    return hasPublishedArticleCategory(category, locale).pipe(
      Effect.map((exists) => (exists ? null : locale))
    );
  }

  if (segments.length !== 2 || !Schema.is(ArticleRouteSlugSchema)(slug)) {
    return Effect.succeed(locale);
  }

  const publicPath = `articles/${category}/${slug}`;
  return readMissingOwnedHtmlLocale({
    family: "article",
    locale,
    publicPath,
  });
}

/** Verifies one exact preview or signed route before app streaming starts. */
function readMissingOwnedHtmlLocale({
  family,
  locale,
  publicPath,
}: {
  family: ContentFamily;
  locale: (typeof routing.locales)[number];
  publicPath: string;
}) {
  return Effect.gen(function* () {
    const appLocale = AppLocaleSchema.make(locale);
    const previewOwnsRoute = yield* matchesPreviewRoute({
      appLocale,
      publicPath,
    });
    if (previewOwnsRoute) {
      return null;
    }

    const ownership = yield* readActiveContentRoute({
      appLocale,
      family,
      publicPath,
    });
    return ownership.kind === "found" ? null : locale;
  });
}
