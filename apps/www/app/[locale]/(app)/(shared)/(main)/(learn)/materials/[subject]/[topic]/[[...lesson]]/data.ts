import {
  isMaterialLessonRoute,
  readParentMaterialRoute,
} from "@repo/contents/_types/route/content";
import { readStaticPublicContentRoutes } from "@repo/contents/_types/route/content/static";
import { readStaticPublicLearningIndex } from "@repo/contents/_types/route/learning/static";
import { readNamespaceSegment } from "@repo/contents/_types/route/path";
import type {
  PublicContentRoute,
  PublicMaterialLessonRoute,
} from "@repo/contents/_types/route/schema";
import { notFound } from "next/navigation";
import { getPublishedMaterialRoutes } from "@/lib/content/material/catalog";
import type { MaterialSourceCandidate } from "@/lib/content/material/route";
import { getLocaleOrThrow } from "@/lib/i18n/params";
import { selectLearningStaticParams } from "@/lib/routing/prerender";

export type MaterialParams =
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

/** Builds the exact localized path without consulting either content owner. */
export async function readMaterialRequest(params: MaterialParams) {
  const { locale: rawLocale, subject, topic, lesson } = await params;
  const locale = getLocaleOrThrow(rawLocale);
  const namespace = readNamespaceSegment("subject", locale);

  if (!namespace) {
    return { locale, publicPath: undefined };
  }

  const publicPath = [namespace, subject, topic, ...(lesson ?? [])].join("/");

  return { locale, publicPath };
}

/**
 * Resolves localized material params through the contents route projection.
 *
 * The projection owns localized slugs, duplicate checks, and source paths. This
 * route Module only matches the framework params to one decoded row.
 */
export async function readMaterialRoute(params: MaterialParams) {
  const { locale, publicPath } = await readMaterialRequest(params);
  if (!publicPath) {
    return { locale, route: undefined };
  }

  const { route } = readMaterialSource(locale, publicPath);

  return {
    locale,
    route,
  };
}

/** Resolves one source route and every identity in its temporary shell. */
export function readMaterialSource(
  locale: PublicMaterialLessonRoute["locale"],
  publicPath: string
) {
  const route = readStaticPublicLearningIndex().resolveRouteByPath(
    publicPath,
    locale
  );
  if (route?.kind !== "subject-lesson") {
    return {
      candidates: [] satisfies readonly MaterialSourceCandidate[],
      route: undefined,
    };
  }
  return { candidates: collectMaterialCandidates(route), route };
}

/** Resolves temporary source-shell identities from one stable content key. */
export function readMaterialCandidates(
  contentKey: string,
  locale: PublicMaterialLessonRoute["locale"]
) {
  const route = readStaticPublicLearningIndex().resolveMaterialRouteBySource(
    contentKey,
    locale
  );
  return route ? collectMaterialCandidates(route) : [];
}

/** Collects locale counterparts and localized siblings for one source route. */
function collectMaterialCandidates(route: PublicMaterialLessonRoute) {
  const candidates = new Map<string, MaterialSourceCandidate>();
  for (const candidate of readMaterialRoutes()) {
    if (
      isMaterialLessonRoute(candidate) &&
      (candidate.sourcePath === route.sourcePath ||
        (candidate.locale === route.locale &&
          candidate.parentPath === route.parentPath))
    ) {
      candidates.set(`${candidate.locale}\0${candidate.sourcePath}`, {
        contentKey: candidate.sourcePath,
        locale: candidate.locale,
      });
    }
  }
  return Array.from(candidates.values());
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
export async function listMaterialStaticParams(rawLocale?: string) {
  const locale = rawLocale ? getLocaleOrThrow(rawLocale) : undefined;
  if (locale) {
    const published = await getPublishedMaterialRoutes(locale);
    if (published.managed) {
      const params = published.routes.map((route) => {
        const [, subject, topic, ...lesson] = route.publicPath.split("/");
        return { lesson, subject, topic };
      });
      return selectLearningStaticParams(params);
    }
  }

  const params = readMaterialRoutes().flatMap((route) => {
    if (locale && route.locale !== locale) {
      return [];
    }
    if (!isMaterialLessonRoute(route)) {
      return [];
    }

    const [, subject, topic, ...lesson] = route.publicPath.split("/");
    return [{ subject, topic, lesson }];
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
