import { getMaterialIcon } from "@repo/contents/_lib/curriculum/material";
import {
  isMaterialContentRoute,
  isMaterialLessonRoute,
  listPublicContentRoutes,
  readContentPathWithoutNamespace,
  readParentMaterialRoute,
} from "@repo/contents/_types/route/content";
import {
  listPublicCurriculumRoutes,
  readCurriculumCardListContext,
} from "@repo/contents/_types/route/curriculum";
import type { PublicContentRoute } from "@repo/contents/_types/route/schema";
import { slugify } from "@repo/design-system/lib/utils";
import { Effect } from "effect";
import { notFound } from "next/navigation";
import { getLocaleOrThrow } from "@/lib/i18n/params";

type MaterialParams =
  PageProps<"/[locale]/materials/[subject]/[topic]/[[...lesson]]">["params"];

export const MATERIAL_ROUTES = Effect.runSync(listPublicContentRoutes());
const CURRICULUM_ROUTES = Effect.runSync(listPublicCurriculumRoutes());

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
  const route = MATERIAL_ROUTES.find(
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
export function requireParentMaterialRoute(route: PublicContentRoute) {
  const parent = readParentMaterialRoute(route, MATERIAL_ROUTES);

  if (parent?.kind !== "subject-topic") {
    notFound();
  }

  return parent;
}

/**
 * Builds the old material header link for the new canonical lesson route.
 *
 * The old route linked a lesson back to the material card list and anchored the
 * current chapter card. Material topic hubs are now internal grouping rows, so
 * this resolves the curriculum subject/course page that renders the card list.
 */
export function readMaterialHeaderLink(route: PublicContentRoute) {
  const parentMaterial = requireParentMaterialRoute(route);
  const curriculumContext = CURRICULUM_ROUTES.find(
    (candidate) =>
      candidate.locale === route.locale &&
      candidate.canonicalPath === parentMaterial.publicPath
  );

  if (!curriculumContext) {
    return;
  }

  const cardListContext = readCurriculumCardListContext(
    curriculumContext,
    CURRICULUM_ROUTES
  );

  if (!cardListContext) {
    return;
  }

  return {
    href: `/${route.locale}/${cardListContext.publicPath}#${slugify(
      curriculumContext.title
    )}`,
    label: curriculumContext.title,
  };
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
