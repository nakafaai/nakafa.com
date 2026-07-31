import type { Locale } from "@repo/contents/_types/content";
import {
  isMaterialContentRoute,
  isMaterialLessonRoute,
} from "@repo/contents/_types/route/content";
import { comparePublicRouteOrder } from "@repo/contents/_types/route/path";
import type { PublicContentRoute } from "@repo/contents/_types/route/schema";

type MaterialLessonRoute = Extract<
  PublicContentRoute,
  { readonly kind: "subject-lesson" }
>;

/**
 * Expands one canonical lesson or topic path into its concrete lesson group.
 *
 * Partial exact releases can move lessons into another topic while source
 * siblings remain. The stable material key keeps both topic groups visible
 * until one release owns the complete family.
 */
export function readMaterialLessonGroup({
  contentRoutes,
  locale,
  publicPath,
}: {
  contentRoutes: readonly PublicContentRoute[];
  locale: Locale;
  publicPath: string;
}): readonly MaterialLessonRoute[] {
  const selected = contentRoutes.find(
    (candidate) =>
      candidate.locale === locale &&
      candidate.publicPath === publicPath &&
      isMaterialContentRoute(candidate)
  );

  if (!selected) {
    return [];
  }

  if (isMaterialLessonRoute(selected)) {
    return [selected];
  }

  const parentPaths = new Set(
    contentRoutes.flatMap((candidate) =>
      candidate.kind === "subject-topic" &&
      candidate.locale === locale &&
      candidate.materialKey === selected.materialKey
        ? [candidate.publicPath]
        : []
    )
  );

  return contentRoutes
    .filter(
      (candidate): candidate is MaterialLessonRoute =>
        isMaterialLessonRoute(candidate) &&
        candidate.locale === locale &&
        candidate.materialKey === selected.materialKey &&
        parentPaths.has(candidate.parentPath)
    )
    .slice()
    .sort(comparePublicRouteOrder);
}
