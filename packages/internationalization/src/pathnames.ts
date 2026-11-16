import { CURRICULUM_NAMESPACES } from "@nakafa/aksara-contracts/program/curriculum";
import { MATERIAL_PUBLIC_NAMESPACES } from "@nakafa/aksara-contracts/projection/material";
import { LOCALES, type Locale } from "@repo/internationalization/src/locale";
import { Array as Arr, Option, Record as Rec } from "effect";

/**
 * The one route map. Each canonical segment is the name the router uses, and it
 * holds the spelling of that segment in every declared locale, which the
 * Aksara contract owns: the curriculum and the material namespaces it
 * publishes routes under.
 */
const LOCALIZED_SEGMENTS = {
  curricula: CURRICULUM_NAMESPACES,
  materials: MATERIAL_PUBLIC_NAMESPACES,
} as const;

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

/**
 * The one locale whose public spelling a segment is, or none when no locale or
 * more than one spells a segment so. A bare address that starts with such a
 * spelling, such as `/materi/...`, names its locale itself, and the rest of the
 * address is that locale's slugs.
 */
export function readSpellingLocale(spelling: string): Option.Option<Locale> {
  const locales = Arr.filter(LOCALES, (locale) =>
    Option.isSome(readCanonicalSpelling(locale, spelling))
  );
  return locales.length === 1 ? Arr.head(locales) : Option.none();
}
