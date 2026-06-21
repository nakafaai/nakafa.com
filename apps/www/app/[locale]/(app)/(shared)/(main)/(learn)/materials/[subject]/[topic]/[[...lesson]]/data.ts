import { getMaterialIcon } from "@repo/contents/_lib/curriculum/material";
import {
  isMaterialContentRoute,
  isMaterialLessonRoute,
  readContentPathWithoutNamespace,
  readParentMaterialRoute,
} from "@repo/contents/_types/route/content";
import { readStaticPublicContentRoutes } from "@repo/contents/_types/route/content/static";
import { readStaticPublicCurriculumRoutes } from "@repo/contents/_types/route/curriculum/static";
import { resolveMaterialHeaderLink } from "@repo/contents/_types/route/material/context";
import { listMaterialContextRefs } from "@repo/contents/_types/route/material/reference";
import type {
  PublicContentRoute,
  PublicCurriculumRoute,
} from "@repo/contents/_types/route/schema";
import { notFound } from "next/navigation";
import { getLocaleOrThrow } from "@/lib/i18n/params";

type MaterialParams =
  PageProps<"/[locale]/materials/[subject]/[topic]/[[...lesson]]">["params"];

let materialRouteCache: readonly PublicContentRoute[] | undefined;
let curriculumRouteCache: readonly PublicCurriculumRoute[] | undefined;

/** Lazily decodes content routes when a framework route function needs them. */
export function readMaterialRoutes() {
  if (materialRouteCache) {
    return materialRouteCache;
  }

  materialRouteCache = readStaticPublicContentRoutes();

  return materialRouteCache;
}

/** Lazily decodes curriculum routes for material header context lookups. */
function readCurriculumRoutes() {
  if (curriculumRouteCache) {
    return curriculumRouteCache;
  }

  curriculumRouteCache = readStaticPublicCurriculumRoutes();

  return curriculumRouteCache;
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
  const routePath = [subject, topic, ...(lesson ?? [])].join("/");
  const route = readMaterialRoutes().find(
    (candidate) =>
      candidate.locale === locale &&
      isMaterialContentRoute(candidate) &&
      readContentPathWithoutNamespace(candidate) === routePath
  );

  return { locale, route };
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

  return readMaterialRoutes()
    .filter((route) => !locale || route.locale === locale)
    .filter(isMaterialLessonRoute)
    .map((route) => {
      const [, subject, topic, ...lesson] = route.publicPath.split("/");

      return { subject, topic, lesson };
    });
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
  context: string | readonly string[] | undefined
) {
  return resolveMaterialHeaderLink({
    context,
    refs: listMaterialContextRefs({
      contentRoutes: readMaterialRoutes(),
      curriculumRoutes: readCurriculumRoutes(),
    }),
    route,
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
