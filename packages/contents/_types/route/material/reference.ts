import type { Locale } from "@repo/contents/_types/content";
import {
  isMaterialContentRoute,
  isMaterialLessonRoute,
} from "@repo/contents/_types/route/content";
import { readCurriculumMaterialContext } from "@repo/contents/_types/route/curriculum/context";
import { comparePublicRouteOrder } from "@repo/contents/_types/route/path";
import type {
  PublicContentRoute,
  PublicCurriculumRoute,
} from "@repo/contents/_types/route/schema";
import { slugify } from "@repo/design-system/lib/routing/slug";

type MaterialLessonRoute = Extract<
  PublicContentRoute,
  { readonly kind: "subject-lesson" }
>;

export type MaterialRouteIdentity = Pick<
  PublicContentRoute,
  "locale" | "materialKey" | "sourcePath"
>;

export interface MaterialContextIdentity {
  nodeKey: string;
  programKey: string;
}

interface MaterialContextIndexInput {
  contentRoutes: readonly PublicContentRoute[];
  curriculumRoutes: readonly PublicCurriculumRoute[];
}

/**
 * Source-owned material return context for one concrete lesson and curriculum card.
 *
 * The ref is not a public route row. It only validates optional `ctx` hints and
 * builds the small header return link when a material was opened from a
 * curriculum card list.
 */
export interface MaterialContextRef extends MaterialContextIdentity {
  anchor: string;
  locale: Locale;
  materialKey: PublicContentRoute["materialKey"];
  parentHref: string;
  parentTitle: string;
  sourcePath: PublicContentRoute["sourcePath"];
}

/**
 * Builds the static material context index from curriculum card groups.
 *
 * The index is data infrastructure only. It never creates public pages or
 * sitemap rows; it lets callers validate a material URL's optional context
 * hint against the source identity that produced the card link.
 */
export function listMaterialContextRefs({
  contentRoutes,
  curriculumRoutes,
}: MaterialContextIndexInput) {
  const refs = new Map<string, MaterialContextRef>();

  for (const curriculumRoute of curriculumRoutes) {
    if (!curriculumRoute.canonicalPath) {
      continue;
    }

    const contextRoute = readCurriculumMaterialContext(
      curriculumRoute,
      curriculumRoutes
    );

    if (!contextRoute) {
      continue;
    }

    for (const materialRoute of readMaterialLessonRoutes({
      contentRoutes,
      locale: curriculumRoute.locale,
      publicPath: curriculumRoute.canonicalPath,
    })) {
      const ref = toMaterialContextRef({
        groupRoute: contextRoute.groupRoute,
        materialRoute,
        parentRoute: contextRoute.parentRoute,
      });

      refs.set(readMaterialContextRefKey(ref), ref);
    }
  }

  return [...refs.values()];
}

/**
 * Returns the matching context ref for one material route and curriculum group.
 *
 * Curriculum card builders use this instead of reconstructing URL query
 * grammar. Missing refs keep the direct canonical material URL.
 */
export function readMaterialContextRef({
  contextRoute,
  refs,
  route,
}: {
  contextRoute: MaterialContextIdentity;
  refs: readonly MaterialContextRef[];
  route: MaterialRouteIdentity;
}) {
  return refs.find(
    (ref) =>
      ref.locale === route.locale &&
      ref.sourcePath === route.sourcePath &&
      ref.materialKey === route.materialKey &&
      ref.programKey === contextRoute.programKey &&
      ref.nodeKey === contextRoute.nodeKey
  );
}

/** Converts a curriculum card group plus material lesson into one context ref. */
function toMaterialContextRef({
  groupRoute,
  materialRoute,
  parentRoute,
}: {
  groupRoute: PublicCurriculumRoute;
  materialRoute: MaterialLessonRoute;
  parentRoute: PublicCurriculumRoute;
}): MaterialContextRef {
  const parentTitle = groupRoute.materialCardTitle ?? groupRoute.title;
  const anchor = slugify(parentTitle);

  return {
    anchor,
    locale: materialRoute.locale,
    materialKey: materialRoute.materialKey,
    nodeKey: groupRoute.nodeKey,
    parentHref: `/${parentRoute.locale}/${parentRoute.publicPath}#${anchor}`,
    parentTitle,
    programKey: groupRoute.programKey,
    sourcePath: materialRoute.sourcePath,
  };
}

/** Builds the stable de-duplication key for one locale/source/context ref. */
function readMaterialContextRefKey(ref: MaterialContextRef) {
  return [ref.locale, ref.sourcePath, ref.programKey, ref.nodeKey].join(":");
}

/**
 * Expands one canonical card material path into concrete lesson routes.
 *
 * A curriculum card can target either one lesson directly or a topic row whose
 * concrete children should all carry the same validated return context.
 */
function readMaterialLessonRoutes({
  contentRoutes,
  locale,
  publicPath,
}: {
  contentRoutes: readonly PublicContentRoute[];
  locale: Locale;
  publicPath: string;
}): readonly MaterialLessonRoute[] {
  const route = contentRoutes.find(
    (candidate) =>
      candidate.locale === locale &&
      candidate.publicPath === publicPath &&
      isMaterialContentRoute(candidate)
  );

  if (!route) {
    return [];
  }

  if (isMaterialLessonRoute(route)) {
    return [route];
  }

  return contentRoutes
    .filter(isMaterialLessonRoute)
    .filter(
      (candidate) =>
        candidate.locale === locale && candidate.parentPath === route.publicPath
    )
    .slice()
    .sort(comparePublicRouteOrder);
}
