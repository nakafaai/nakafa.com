import { isRenderableCurriculumLevel } from "@nakafa/aksara-contracts/program/curriculum";
import type { MaterialLessonProjection } from "@nakafa/aksara-contracts/projection/material";
import { PUBLIC_ROUTE_SURFACES } from "@repo/contents/_types/route/surface";
import type { routing } from "@repo/internationalization/src/routing";
import { Effect, Option } from "effect";
import {
  readPublishedArticleCategory,
  readPublishedCategoryAlternates,
} from "@/lib/content/article/category";
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

interface PublishedLocalizedHrefInput {
  currentLocale: Locale;
  hash: string;
  locale: Locale;
  publicPath: string;
  search: string;
}

const ARTICLE_NAMESPACE = "articles";

/** Creates a next-intl href without a locale prefix. */
function toNavigationHref(publicPath: string, suffix: string) {
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
      const target = alternates.find(
        (alternate) => alternate.appLocale === input.locale
      );
      if (!target) {
        return yield* new MissingLocalizedRouteProjectionError({
          locale: input.locale,
          publicPath: input.publicPath,
        });
      }

      return toNavigationHref(
        target.publicPath,
        `${input.search}${input.hash}`
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

      const target = current.alternates.find(
        (alternate) => alternate.appLocale === input.locale
      );
      if (!target) {
        return yield* new MissingLocalizedRouteProjectionError({
          locale: input.locale,
          publicPath: input.publicPath,
        });
      }

      return toNavigationHref(
        target.publicPath,
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
  const segments = publicPath.split("/").filter(Boolean);
  const namespace = segments[0];

  if (namespace === ARTICLE_NAMESPACE) {
    return yield* readLocalizedArticleHref(
      { currentLocale, hash, locale, publicPath, search },
      segments
    );
  }

  const surface = PUBLIC_ROUTE_SURFACES.find(
    (candidate) => candidate.routeSlugs[currentLocale] === namespace
  );

  if (surface?.key === "subject") {
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
    const target = current.alternates.find(
      (alternate) => alternate.appLocale === locale
    );
    if (!target) {
      return yield* new MissingLocalizedRouteProjectionError({
        locale,
        publicPath,
      });
    }
    const suffix = yield* readLocalizedMaterialSuffix({
      expectedActiveReleaseId: current.activeReleaseId,
      locale,
      search,
      target,
    });
    return toNavigationHref(target.publicPath, `${suffix}${hash}`);
  }

  if (surface?.key === "tryout") {
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

  if (!surface) {
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
  const target = current.alternates.find(
    (alternate) =>
      alternate.appLocale === locale &&
      alternate.nodeKey === current.route?.nodeKey &&
      alternate.programKey === current.route?.programKey &&
      alternate.sitemap &&
      isRenderableCurriculumLevel(alternate.level)
  );
  if (!target) {
    return yield* new MissingLocalizedRouteProjectionError({
      locale,
      publicPath,
    });
  }
  return toNavigationHref(target.publicPath, `${search}${hash}`);
});
