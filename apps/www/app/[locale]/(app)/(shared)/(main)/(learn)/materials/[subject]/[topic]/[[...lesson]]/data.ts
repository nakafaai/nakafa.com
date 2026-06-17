import { getMaterialIcon } from "@repo/contents/_lib/curriculum/material";
import type { ContentPagination } from "@repo/contents/_types/content";
import { listPublicContentRoutesEffect } from "@repo/contents/_types/route/projection";
import type { PublicContentRoute } from "@repo/contents/_types/route/schema";
import { Effect } from "effect";
import { notFound } from "next/navigation";
import { getLocaleOrThrow } from "@/lib/i18n/params";

type MaterialParams =
  PageProps<"/[locale]/materials/[subject]/[topic]/[[...lesson]]">["params"];
export type MaterialRoute = PublicContentRoute & {
  kind: "subject-lesson" | "subject-topic";
};
export type MaterialLessonRoute = PublicContentRoute & {
  kind: "subject-lesson";
};

const MATERIAL_ROUTES = Effect.runSync(listPublicContentRoutesEffect());

export { MATERIAL_ROUTES };

/**
 * Resolves localized material params through the contents route projection.
 *
 * The projection owns localized slugs, duplicate checks, and source paths. This
 * route Module only matches the framework params to one decoded row.
 */
export async function resolveMaterialRoute(params: MaterialParams) {
  const { locale: rawLocale, subject, topic, lesson } = await params;
  const locale = getLocaleOrThrow(rawLocale);
  const routePath = [subject, topic, ...(lesson ?? [])].join("/");
  const route = MATERIAL_ROUTES.find(
    (candidate) =>
      candidate.locale === locale &&
      isMaterialRoute(candidate) &&
      readPathWithoutNamespace(candidate.publicPath) === routePath
  );

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
export function listMaterialStaticParams() {
  return MATERIAL_ROUTES.filter(isMaterialLessonRoute).map((route) => {
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
export function requireParentMaterialRoute(route: MaterialRoute) {
  if (!route.parentPath) {
    notFound();
  }

  const parent = MATERIAL_ROUTES.find(
    (candidate) =>
      candidate.locale === route.locale &&
      candidate.kind === "subject-topic" &&
      candidate.publicPath === route.parentPath
  );

  if (parent?.kind !== "subject-topic") {
    notFound();
  }

  return parent;
}

/**
 * Builds previous and next links between sibling lesson routes.
 *
 * Topic rows get empty pagination because the collapsible card already lists
 * every child lesson in order.
 */
export function getMaterialPagination(route: MaterialRoute): ContentPagination {
  const emptyItem = { href: "", title: "" };

  if (!(isMaterialLessonRoute(route) && route.parentPath)) {
    return { prev: emptyItem, next: emptyItem };
  }

  const siblings = MATERIAL_ROUTES.filter(isMaterialLessonRoute).filter(
    (candidate) =>
      candidate.locale === route.locale &&
      candidate.parentPath === route.parentPath
  );
  const currentIndex = siblings.findIndex(
    (candidate) => candidate.publicPath === route.publicPath
  );

  if (currentIndex === -1) {
    return { prev: emptyItem, next: emptyItem };
  }

  return {
    prev: readPaginationItem(siblings.at(currentIndex - 1)),
    next: readPaginationItem(siblings.at(currentIndex + 1)),
  };
}

/**
 * Selects the subject-specific icon from one projected material source path.
 *
 * The icon mapping is the same app-owned material icon mapping used by the
 * previous subject pages.
 */
export function getProjectedMaterialIcon(route: MaterialRoute) {
  const [, , domain] = route.sourcePath.split("/");

  return getMaterialIcon(domain ?? "");
}

/**
 * Converts one projected route row to an app-localized navigation href.
 *
 * This keeps every link on the new canonical public path instead of the source
 * asset path.
 */
export function toLocalizedHref(
  route: Pick<MaterialRoute, "locale" | "publicPath">
) {
  return `/${route.locale}/${route.publicPath}`;
}

/** Checks whether one content row belongs to the material route surface. */
function isMaterialRoute(route: PublicContentRoute): route is MaterialRoute {
  return route.kind === "subject-topic" || route.kind === "subject-lesson";
}

/** Checks whether one material row is a concrete lesson. */
export function isMaterialLessonRoute(
  route: PublicContentRoute
): route is MaterialLessonRoute {
  return route.kind === "subject-lesson";
}

/** Removes the localized namespace segment from one projected public path. */
function readPathWithoutNamespace(publicPath: string) {
  return publicPath.split("/").slice(1).join("/");
}

/** Returns one pagination item while preserving empty endpoints. */
function readPaginationItem(route: MaterialLessonRoute | undefined) {
  if (!route) {
    return { href: "", title: "" };
  }

  return {
    href: toLocalizedHref(route),
    title: route.title,
  };
}
