import { isRenderableCurriculumLevel } from "@nakafa/aksara-contracts/program/curriculum";
import type { MaterialLessonProjection } from "@nakafa/aksara-contracts/projection/material";
import { PUBLIC_ROUTE_SURFACES } from "@repo/contents/_types/route/surface";
import type { routing } from "@repo/internationalization/src/routing";
import { Effect } from "effect";
import { readPublishedMaterialContext } from "@/lib/content/material/context";
import type { MaterialReleasePin } from "@/lib/content/material/release";
import { readPublishedMaterialRoute } from "@/lib/content/material/route";
import { readPublishedProgramRoute } from "@/lib/content/program/route";
import { MissingLocalizedRouteProjectionError } from "@/lib/routing/locale/error";
import {
  readMaterialContextQuery,
  toMaterialContextQueryString,
} from "@/lib/routing/material/query";

type Locale = (typeof routing.locales)[number];

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

/** Preserves material context only when the signed target validates it. */
const readLocalizedMaterialSuffix = Effect.fn(
  "www.routing.locale.readMaterialSuffix"
)(function* ({
  expectedActiveReleaseId,
  locale,
  search,
  target,
}: {
  expectedActiveReleaseId: Exclude<MaterialReleasePin, null>;
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
    const suffix = yield* readLocalizedMaterialSuffix({
      expectedActiveReleaseId: current.activeReleaseId,
      locale,
      search,
      target,
    });
    return toNavigationHref(target.publicPath, suffix);
  }

  if (surface?.key !== "curriculum") {
    return null;
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
