import {
  ArticleCategorySchema,
  ArticleSlugSchema,
} from "@nakafa/aksara-contracts/projection/article";
import { PUBLIC_ROUTE_SURFACES } from "@repo/contents/_types/route/surface";
import { ARTICLE_CATEGORIES } from "@repo/contents/_types/taxonomy";
import { routing } from "@repo/internationalization/src/routing";
import { Effect, Schema } from "effect";
import { hasLocale } from "next-intl";
import { readPublishedArticleCategory } from "@/lib/content/article/ownership";
import { matchesPreviewRoute } from "@/lib/content/preview/route";
import { readActiveContentIdentity } from "@/lib/content/published/active";
import { readActiveContentRoute } from "@/lib/content/published/route";
import { getRuntimeContentRoute } from "@/lib/content/runtime/routes";

const REJECTED_PUBLIC_ROOTS = new Set(["/learn"]);
const MARKDOWN_EXTENSION_PATTERN = /\.mdx?$/;
const QURAN_SURAH_COUNT = 114;

/**
 * Reads route rejections that must run before markdown negotiation.
 *
 * Wrong public namespaces and finite source-backed HTML routes should return a
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

  return yield* readMissingHtmlContentLocale({ method, pathname });
});

/**
 * Rejects known public-route namespaces when a request uses a stale slug.
 *
 * This is a clean cutover check: known non-canonical namespaces become 404s
 * instead of being treated as localized pages.
 */
function readRejectedPublicRouteLocale(pathname: string) {
  if (REJECTED_PUBLIC_ROOTS.has(pathname)) {
    return routing.defaultLocale;
  }

  const [locale, namespace] = pathname.split("/").filter(Boolean);

  if (!(namespace && hasLocale(routing.locales, locale))) {
    return null;
  }

  const usesRejectedNamespace = PUBLIC_ROUTE_SURFACES.some((surface) => {
    const expectedNamespace = surface.routeSlugs[locale];
    const knownNamespaces = [
      surface.appSegment,
      surface.key,
      ...Object.values(surface.routeSlugs),
    ];

    return (
      namespace !== expectedNamespace &&
      knownNamespaces.some((knownNamespace) => knownNamespace === namespace)
    );
  });

  return usesRejectedNamespace ? locale : null;
}

/**
 * Reads finite source-backed HTML routes that should 404 before app rendering.
 *
 * Quran and article detail pages have finite source inventories. Rejecting
 * impossible shapes here prevents Next streamed not-found responses from
 * looking like successful soft 404s to agents and crawlers.
 */
function readMissingHtmlContentLocale({
  method,
  pathname,
}: {
  method: string;
  pathname: string;
}) {
  if (!(method === "GET" || method === "HEAD")) {
    return Effect.succeed(null);
  }

  const [locale, root, ...segments] = pathname.split("/").filter(Boolean);

  if (!(root && hasLocale(routing.locales, locale))) {
    return Effect.succeed(null);
  }

  if (MARKDOWN_EXTENSION_PATTERN.test(pathname)) {
    return Effect.succeed(null);
  }

  if (root === "quran") {
    return Effect.succeed(isRenderableQuranPath(segments) ? null : locale);
  }

  if (root !== "articles") {
    return Effect.succeed(null);
  }

  return readMissingArticleHtmlLocale({
    locale,
    segments,
  });
}

/** Checks whether one Quran route path can be rendered by the source corpus. */
function isRenderableQuranPath(segments: readonly string[]) {
  if (segments.length === 0) {
    return true;
  }

  if (segments.length !== 1) {
    return false;
  }

  const surah = segments.join("");
  const surahNumber = Number.parseInt(surah, 10);

  return (
    Number.isSafeInteger(surahNumber) &&
    `${surahNumber}` === surah &&
    surahNumber >= 1 &&
    surahNumber <= QURAN_SURAH_COUNT
  );
}

/** Verifies article paths against their exclusive published or source owner. */
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
  if (!Schema.is(ArticleCategorySchema)(category)) {
    return Effect.succeed(locale);
  }

  if (segments.length === 1) {
    return readPublishedArticleCategory(category, locale).pipe(
      Effect.map((ownership) => {
        if (ownership.managed) {
          return ownership.exists ? null : locale;
        }
        return ARTICLE_CATEGORIES.some((item) => item === category)
          ? null
          : locale;
      })
    );
  }

  if (segments.length !== 2 || !Schema.is(ArticleSlugSchema)(slug)) {
    return Effect.succeed(locale);
  }

  const publicPath = `articles/${category}/${slug}`;
  return Effect.gen(function* () {
    const previewOwnsRoute = yield* matchesPreviewRoute({ locale, publicPath });
    if (previewOwnsRoute) {
      return null;
    }

    const identity = yield* readActiveContentIdentity();
    const ownership = yield* readActiveContentRoute({
      activeReleaseId: identity?.releaseId ?? null,
      family: "article",
      locale,
      publicPath,
    });
    if (ownership.kind === "found") {
      return null;
    }
    if (ownership.kind === "missing") {
      return locale;
    }
    const contentRoute = yield* getRuntimeContentRoute({
      locale,
      route: publicPath,
    });
    return contentRoute ? null : locale;
  });
}
