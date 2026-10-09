import { isRenderableCurriculumLevel } from "@nakafa/aksara-contracts/program/curriculum";
import type { MaterialLessonProjection } from "@nakafa/aksara-contracts/projection/material";
import { PUBLIC_ROUTE_SURFACES } from "@repo/contents/route/surface";
import { routing } from "@repo/internationalization/src/routing";
import { Array as Arr, Effect, Option, Schema } from "effect";
import {
  readPublishedArticleCategory,
  readPublishedCategoryAlternates,
} from "@/lib/content/article/category";
import { stripArticlePagination } from "@/lib/content/article/query";
import { readPublishedArticleRoute } from "@/lib/content/article/route";
import { readPublishedMaterialContext } from "@/lib/content/material/context";
import { readPublishedMaterialRoute } from "@/lib/content/material/route";
import { readPublishedPageLocalePath } from "@/lib/content/page/catalog";
import { readPublishedProgramRoute } from "@/lib/content/program/route";
import type { ContentReleasePin } from "@/lib/content/published/release";
import { readPublishedTryoutLocalizedPath } from "@/lib/content/tryout/path";
import { MissingLocalizedRouteProjectionError } from "@/lib/routing/locale/error";
import {
  readMaterialContextQuery,
  toMaterialContextQueryString,
} from "@/lib/routing/material/query";

type Locale = (typeof routing.locales)[number];

const LocaleSchema = Schema.Literals(routing.locales);

const PublishedLocalizedHrefInputSchema = Schema.Struct({
  currentLocale: LocaleSchema,
  hash: Schema.String,
  locale: LocaleSchema,
  publicPath: Schema.String,
  search: Schema.String,
});
type PublishedLocalizedHrefInput =
  typeof PublishedLocalizedHrefInputSchema.Type;

const ARTICLE_NAMESPACE = "articles";

/**
 * Returns a next-intl navigation href without a locale prefix; the router adds
 * the target locale using its configured localized pathname mapping.
 */
export function toNavigationHref(publicPath: string, suffix: string) {
  return `/${publicPath}${suffix}`;
}

/** Resolves one article route through its signed locale identity. */
const readLocalizedArticleHref = Effect.fn("www.routing.locale.readArticle")(
  function* (input: PublishedLocalizedHrefInput, segments: readonly string[]) {
    if (segments.length === 1) {
      return null;
    }

    if (segments.length === 2) {
      const current = yield* readPublishedArticleCategory(
        segments[1],
        input.currentLocale
      );
      if (Option.isNone(current)) {
        return yield* new MissingLocalizedRouteProjectionError({
          locale: input.locale,
          publicPath: input.publicPath,
        });
      }

      const alternates = yield* readPublishedCategoryAlternates(current.value);
      const target = Arr.findFirst(
        alternates,
        (alternate) => alternate.appLocale === input.locale
      );
      if (Option.isNone(target)) {
        return yield* new MissingLocalizedRouteProjectionError({
          locale: input.locale,
          publicPath: input.publicPath,
        });
      }

      return toNavigationHref(
        target.value.publicPath,
        `${stripArticlePagination(input.search)}${input.hash}`
      );
    }

    if (segments.length === 3) {
      const current = yield* readPublishedArticleRoute(
        input.currentLocale,
        input.publicPath
      );
      if (!current.projection) {
        return yield* new MissingLocalizedRouteProjectionError({
          locale: input.locale,
          publicPath: input.publicPath,
        });
      }

      const target = Arr.findFirst(
        current.alternates,
        (alternate) => alternate.appLocale === input.locale
      );
      if (Option.isNone(target)) {
        return yield* new MissingLocalizedRouteProjectionError({
          locale: input.locale,
          publicPath: input.publicPath,
        });
      }

      return toNavigationHref(
        target.value.publicPath,
        `${input.search}${input.hash}`
      );
    }

    return yield* new MissingLocalizedRouteProjectionError({
      locale: input.locale,
      publicPath: input.publicPath,
    });
  }
);

/** Preserves material context only when the signed target validates it. */
const readLocalizedMaterialSuffix = Effect.fn(
  "www.routing.locale.readMaterialSuffix"
)(function* ({
  expectedActiveReleaseId,
  locale,
  search,
  target,
}: {
  expectedActiveReleaseId: Exclude<ContentReleasePin, null>;
  locale: Locale;
  search: string;
  target: MaterialLessonProjection;
}) {
  const context = readMaterialContextQuery(search);
  if (!context) {
    return "";
  }

  const published = yield* readPublishedMaterialContext(
    locale,
    target,
    context,
    expectedActiveReleaseId
  );
  return published ? toMaterialContextQueryString(context) : "";
});

/** Resolves an Aksara-owned localized route counterpart. */
export const readPublishedLocalizedHref = Effect.fn(
  "www.routing.locale.readPublished"
)(function* ({
  currentLocale,
  hash,
  locale,
  publicPath,
  search,
}: PublishedLocalizedHrefInput) {
  const segments = Arr.filter(publicPath.split("/"), Boolean);
  const namespace = segments[0];

  if (namespace === ARTICLE_NAMESPACE) {
    return yield* readLocalizedArticleHref(
      { currentLocale, hash, locale, publicPath, search },
      segments
    );
  }

  const surface = Arr.findFirst(
    PUBLIC_ROUTE_SURFACES,
    (candidate) => candidate.routeSlugs[currentLocale] === namespace
  );

  if (Option.exists(surface, (found) => found.key === "subject")) {
    const current = yield* readPublishedMaterialRoute(
      currentLocale,
      publicPath
    );
    if (!current.projection) {
      return yield* new MissingLocalizedRouteProjectionError({
        locale,
        publicPath,
      });
    }
    const target = Arr.findFirst(
      current.alternates,
      (alternate) => alternate.appLocale === locale
    );
    if (Option.isNone(target)) {
      return yield* new MissingLocalizedRouteProjectionError({
        locale,
        publicPath,
      });
    }
    const suffix = yield* readLocalizedMaterialSuffix({
      expectedActiveReleaseId: current.activeReleaseId,
      locale,
      search,
      target: target.value,
    });
    return toNavigationHref(target.value.publicPath, `${suffix}${hash}`);
  }

  if (Option.exists(surface, (found) => found.key === "tryout")) {
    const target = yield* readPublishedTryoutLocalizedPath({
      currentAppLocale: currentLocale,
      publicPath,
      targetAppLocale: locale,
    });
    if (!target) {
      return yield* new MissingLocalizedRouteProjectionError({
        locale,
        publicPath,
      });
    }
    return toNavigationHref(target, `${search}${hash}`);
  }

  if (Option.isNone(surface)) {
    const target = yield* readPublishedPageLocalePath({
      currentLocale,
      locale,
      publicPath,
    });
    if (target.kind === "unmanaged") {
      return null;
    }
    if (target.kind === "missing") {
      return yield* new MissingLocalizedRouteProjectionError({
        locale,
        publicPath,
      });
    }
    return toNavigationHref(target.publicPath, `${search}${hash}`);
  }

  const current = yield* readPublishedProgramRoute(currentLocale, publicPath);
  if (!current.route) {
    return yield* new MissingLocalizedRouteProjectionError({
      locale,
      publicPath,
    });
  }
  const target = Arr.findFirst(
    current.alternates,
    (alternate) =>
      alternate.appLocale === locale &&
      alternate.nodeKey === current.route?.nodeKey &&
      alternate.programKey === current.route?.programKey &&
      alternate.sitemap &&
      isRenderableCurriculumLevel(alternate.level)
  );
  if (Option.isNone(target)) {
    return yield* new MissingLocalizedRouteProjectionError({
      locale,
      publicPath,
    });
  }
  return toNavigationHref(target.value.publicPath, `${search}${hash}`);
});
