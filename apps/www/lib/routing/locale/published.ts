import { isRenderableCurriculumLevel } from "@nakafa/aksara-contracts/program/curriculum";
import { loadStaticPublicLearningIndex } from "@repo/contents/_types/route/learning/static";
import { PUBLIC_ROUTE_SURFACES } from "@repo/contents/_types/route/surface";
import type { routing } from "@repo/internationalization/src/routing";
import { Effect } from "effect";
import { readPublishedMaterialContext } from "@/lib/content/material/context";
import { readPublishedMaterialRoute } from "@/lib/content/material/route";
import { readPublishedProgramRoute } from "@/lib/content/program/route";
import {
  MissingLocalizedRouteProjectionError,
  readProjectedRouteSuffix,
} from "@/lib/routing/locale/project";
import {
  readMaterialContextQuery,
  toMaterialContextQueryString,
} from "@/lib/routing/material/query";

/** Locale values accepted by next-intl routing and public route projection. */
type Locale = (typeof routing.locales)[number];

/** Active-owner locale projection request. */
interface PublishedLocalizedHrefInput {
  currentLocale: Locale;
  locale: Locale;
  publicPath: string;
  search: string;
}

/** Creates a next-intl href without a locale prefix. */
function toNavigationHref(publicPath: string, suffix: string) {
  return `/${publicPath}${suffix}`;
}

/** Resolves an Aksara-owned material or curriculum locale counterpart. */
export const readPublishedLocalizedHref = Effect.fn(
  "www.routing.locale.readPublished"
)(function* ({
  currentLocale,
  locale,
  publicPath,
  search,
}: PublishedLocalizedHrefInput) {
  const namespace = publicPath.split("/").filter(Boolean)[0];
  const surface = PUBLIC_ROUTE_SURFACES.find(
    (candidate) => candidate.routeSlugs[currentLocale] === namespace
  );

  if (surface?.key === "subject") {
    const current = yield* readPublishedMaterialRoute(
      currentLocale,
      publicPath
    );
    if (!current.managed) {
      return null;
    }
    if (!current.projection) {
      return yield* new MissingLocalizedRouteProjectionError({
        locale,
        publicPath,
      });
    }

    const target = current.alternates.find(
      (alternate) => alternate.locale === locale
    );
    if (!target) {
      return yield* new MissingLocalizedRouteProjectionError({
        locale,
        publicPath,
      });
    }

    const context = readMaterialContextQuery(search);
    if (!context) {
      return toNavigationHref(target.publicPath, "");
    }

    const publishedContext = yield* readPublishedMaterialContext(
      locale,
      target,
      context
    );
    if (publishedContext.managed) {
      const suffix = publishedContext.value
        ? toMaterialContextQueryString(context)
        : "";
      return toNavigationHref(target.publicPath, suffix);
    }

    const index = yield* loadStaticPublicLearningIndex();
    const sourceRoute = index.resolveMaterialRouteBySource(
      current.projection.contentKey,
      currentLocale
    );
    const targetRoute = index.resolveMaterialRouteBySource(
      target.contentKey,
      locale
    );
    if (!(sourceRoute && targetRoute)) {
      return toNavigationHref(target.publicPath, "");
    }

    return toNavigationHref(
      target.publicPath,
      readProjectedRouteSuffix({
        index,
        route: sourceRoute,
        search,
        targetRoute,
      })
    );
  }

  if (surface?.key !== "curriculum") {
    return null;
  }

  const current = yield* readPublishedProgramRoute(currentLocale, publicPath);
  if (!current.managed) {
    return null;
  }
  if (!current.route) {
    return yield* new MissingLocalizedRouteProjectionError({
      locale,
      publicPath,
    });
  }

  const target = current.alternates.find(
    (alternate) =>
      alternate.locale === locale &&
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

  return toNavigationHref(target.publicPath, "");
});
