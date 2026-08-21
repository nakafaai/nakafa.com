export const SCHOOL_ROUTE_SLUGS = {
  onboarding: "onboarding",
  select: "select",
} as const;

const reservedSchoolSlugs = new Set<string>(Object.values(SCHOOL_ROUTE_SLUGS));

/** Checks whether a slug is owned by a static School route. */
export function isReservedSchoolSlug(slug: string) {
  return reservedSchoolSlugs.has(slug);
}
