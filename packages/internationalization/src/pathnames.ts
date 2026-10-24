import type { Locale } from "@repo/internationalization/src/locale";
import { Array as Arr, Option, Record as Rec } from "effect";

/**
 * The one route map. Each canonical segment is the name the router uses, and it
 * holds the spelling of that segment in every locale. `satisfies` makes a new
 * locale fail the build until every segment has its spelling.
 */
const LOCALIZED_SEGMENTS = {
  curricula: { de: "lehrplaene", en: "curriculum", id: "kurikulum" },
  materials: { de: "faecher", en: "subjects", id: "materi" },
} as const satisfies Record<string, Record<Locale, string>>;

type CanonicalSegment = keyof typeof LOCALIZED_SEGMENTS;

const CANONICAL_SEGMENTS: readonly CanonicalSegment[] =
  Rec.keys(LOCALIZED_SEGMENTS);

/** The localized template of a route: the segment spelling in each locale, then the rest of the template. */
function localizedTemplate(canonical: CanonicalSegment, rest: string) {
  return Rec.map(
    LOCALIZED_SEGMENTS[canonical],
    (spelling) => `/${spelling}${rest}`
  );
}

/**
 * The localized templates of the routes that the sitemap, the llms index and
 * the subject menu name, keyed by the canonical route template. Each template is
 * built from the segment spellings above, so every spelling lives in one place.
 */
export const PATHNAMES = {
  "/curricula": localizedTemplate("curricula", ""),
  "/curricula/[curriculum]/[[...path]]": localizedTemplate(
    "curricula",
    "/[curriculum]/[[...path]]"
  ),
  "/materials/[subject]/[topic]/[[...lesson]]": localizedTemplate(
    "materials",
    "/[subject]/[topic]/[[...lesson]]"
  ),
};

/** The spelling of one canonical segment in one locale. */
export function publicSegment(canonical: CanonicalSegment, locale: Locale) {
  return LOCALIZED_SEGMENTS[canonical][locale];
}

/** The canonical segment that a path segment names as the router spells it, or none. */
export function readCanonicalName(
  segment: string
): Option.Option<CanonicalSegment> {
  return Arr.findFirst(CANONICAL_SEGMENTS, (canonical) =>
    canonical === segment ? Option.some(canonical) : Option.none()
  );
}

/** The canonical segment that one public spelling names in one locale, or none. */
export function readCanonicalSpelling(
  locale: Locale,
  spelling: string
): Option.Option<CanonicalSegment> {
  return Arr.findFirst(CANONICAL_SEGMENTS, (canonical) =>
    publicSegment(canonical, locale) === spelling
      ? Option.some(canonical)
      : Option.none()
  );
}
