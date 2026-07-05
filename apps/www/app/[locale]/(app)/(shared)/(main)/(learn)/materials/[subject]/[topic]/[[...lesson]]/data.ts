import { getMaterialIcon } from "@repo/contents/_lib/curriculum/material";
import {
  isMaterialLessonRoute,
  readMaterialPagination,
  readParentMaterialRoute,
  toLocalizedContentHref,
} from "@repo/contents/_types/route/content";
import { readStaticPublicContentRoutes } from "@repo/contents/_types/route/content/static";
import { readStaticPublicLearningIndex } from "@repo/contents/_types/route/learning/static";
import type { MaterialContextIdentity } from "@repo/contents/_types/route/material/reference";
import { readNamespaceSegment } from "@repo/contents/_types/route/path";
import type {
  PublicContentRoute,
  PublicRoute,
} from "@repo/contents/_types/route/schema";
import { notFound } from "next/navigation";
import { getLocaleOrThrow } from "@/lib/i18n/params";
import { selectLearningStaticParams } from "@/lib/routing/prerender";

type MaterialParams =
  PageProps<"/[locale]/materials/[subject]/[topic]/[[...lesson]]">["params"];

let materialRouteCache: readonly PublicContentRoute[] | undefined;

/** Lazily decodes content routes when a framework route function needs them. */
export function readMaterialRoutes() {
  if (materialRouteCache) {
    return materialRouteCache;
  }

  materialRouteCache = readStaticPublicContentRoutes();

  return materialRouteCache;
}

/**
 * Resolves localized material params through the contents route projection.
 *
 * The projection owns localized slugs, duplicate checks, and source paths. This
 * route Module only matches the framework params to one decoded row.
 */
export async function readMaterialRoute(params: MaterialParams) {
  const { locale: rawLocale, subject, topic, lesson } = await params;
  const locale = getLocaleOrThrow(rawLocale);
  const namespace = readNamespaceSegment("subject", locale);

  if (!namespace) {
    return { locale, route: undefined };
  }

  const publicPath = [namespace, subject, topic, ...(lesson ?? [])].join("/");
  const route = readStaticPublicLearningIndex().resolveRouteByPath(
    publicPath,
    locale
  );

  return {
    locale,
    route: isProjectedMaterialContentRoute(route) ? route : undefined,
  };
}

/** Narrows indexed public-route lookups to source-owned material rows only. */
function isProjectedMaterialContentRoute(
  route: PublicRoute | undefined
): route is PublicContentRoute {
  return Boolean(
    route && (route.kind === "subject-topic" || route.kind === "subject-lesson")
  );
}

/**
 * Resolves one public material lesson route or enters the not-found boundary.
 *
 * Topic rows stay projected for card grouping and parent links, but they are
 * not standalone public pages.
 */
export async function resolveMaterialRoute(params: MaterialParams) {
  const { locale, route } = await readMaterialRoute(params);

  if (!(route && isMaterialLessonRoute(route))) {
    notFound();
  }

  return { locale, route };
}

/**
 * Builds static params only for concrete material lesson body rows.
 *
 * Topic rows stay in the projection for internal curriculum grouping
 * cards and lesson pagination. They are not standalone public page hops.
 */
export function listMaterialStaticParams(rawLocale?: string) {
  const locale = rawLocale ? getLocaleOrThrow(rawLocale) : undefined;

  const params = readMaterialRoutes()
    .filter((route) => !locale || route.locale === locale)
    .filter(isMaterialLessonRoute)
    .map((route) => {
      const [, subject, topic, ...lesson] = route.publicPath.split("/");

      return { subject, topic, lesson };
    });

  return selectLearningStaticParams(params);
}

/**
 * Returns the topic route that owns one lesson route.
 *
 * Missing parents are treated like invalid generated route state and mapped to
 * the route-not-found boundary.
 */
export function requireParentMaterialRoute(route: PublicContentRoute) {
  const parent = readParentMaterialRoute(route, readMaterialRoutes());

  if (parent?.kind !== "subject-topic") {
    notFound();
  }

  return parent;
}

/**
 * Resolves the material header return link from an explicit curriculum context.
 *
 * Direct canonical material visits intentionally render without an invented
 * curriculum parent. Stale or mismatched context query values are ignored.
 */
export function readMaterialHeaderLink(
  route: PublicContentRoute,
  context: MaterialContextIdentity | undefined
) {
  return readStaticPublicLearningIndex().resolveMaterialHeaderLink({
    context,
    route,
  });
}

/**
 * Builds material sibling pagination while preserving a validated source context.
 *
 * Canonical visits and stale context hints use plain material URLs. Contextual
 * visits keep the same source card identity on previous/next lesson links only
 * when the current page and target sibling both validate against the index.
 */
export function readMaterialPagePagination(
  route: PublicContentRoute,
  context: MaterialContextIdentity | undefined
) {
  const index = readStaticPublicLearningIndex();

  if (!(context && index.resolveMaterialHeaderLink({ context, route }))) {
    return readMaterialPagination(route, readMaterialRoutes());
  }

  return readMaterialPagination(route, readMaterialRoutes(), {
    toHref: (targetRoute) =>
      index.toContextualMaterialHref({
        context,
        href: toLocalizedContentHref(targetRoute),
        route: targetRoute,
      }),
  });
}

/**
 * Selects the subject-specific icon from one projected material source path.
 *
 * The icon mapping is the same app-owned material icon mapping used by the
 * previous subject pages.
 */
export function getProjectedMaterialIcon(route: PublicContentRoute) {
  const [, , domain] = route.sourcePath.split("/");

  return getMaterialIcon(domain ?? "");
}
