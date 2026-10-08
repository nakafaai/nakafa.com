import { HashSet, Record as Rec } from "effect";
export const SCHOOL_ROUTE_SLUGS = {
  onboarding: "onboarding",
  select: "select",
} as const;
const reservedSchoolSlugs = HashSet.fromIterable<string>(
  Rec.values(SCHOOL_ROUTE_SLUGS)
);

/** Checks whether a slug is owned by a static School route. */
export function isReservedSchoolSlug(slug: string) {
  return HashSet.has(reservedSchoolSlugs, slug);
}
