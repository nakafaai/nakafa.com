import {
  findPublicContentRouteBySourcePath,
  isMaterialLessonRoute,
  toLocalizedContentHref,
} from "@repo/contents/_types/route/content";
import { routing } from "@repo/internationalization/src/routing";
import { Effect, Option } from "effect";
import { hasLocale } from "next-intl";

const PREVIOUS_SUBJECT_NAMESPACE = "subject";
const MATERIAL_LESSON_SOURCE_ROOT = "material/lesson";
const REDIRECTABLE_METHODS = new Set(["GET", "HEAD"]);

/**
 * Finds the canonical target for permanent public URL migrations.
 *
 * Previous material lesson URLs never render old pages. They only redirect to
 * the source-owned canonical route so Google and users land on the new surface.
 */
export const readPublicUrlMigrationRedirect = Effect.fn(
  "www.routing.publicHtml.urlMigrationRedirect"
)(function* ({ method, pathname }: { method: string; pathname: string }) {
  if (!REDIRECTABLE_METHODS.has(method)) {
    return null;
  }

  const sourcePath = readPreviousSubjectLessonSourcePath(pathname);

  if (!sourcePath) {
    return null;
  }

  const route = yield* findPublicContentRouteBySourcePath(
    sourcePath.sourcePath,
    sourcePath.locale
  );

  return Option.match(route, {
    onNone: () => null,
    onSome: (canonicalRoute) => {
      if (!isMaterialLessonRoute(canonicalRoute)) {
        return null;
      }

      return toLocalizedContentHref(canonicalRoute);
    },
  });
});

/** Converts one previous subject URL into its source-owned lesson path. */
function readPreviousSubjectLessonSourcePath(pathname: string) {
  const [locale, namespace, _category, _grade, material, ...lessonSegments] =
    pathname.split("/").filter(Boolean);

  if (!(namespace === PREVIOUS_SUBJECT_NAMESPACE && material)) {
    return null;
  }

  if (lessonSegments.length === 0) {
    return null;
  }

  if (!hasLocale(routing.locales, locale)) {
    return null;
  }

  return {
    locale,
    sourcePath: [MATERIAL_LESSON_SOURCE_ROOT, material, ...lessonSegments].join(
      "/"
    ),
  };
}
