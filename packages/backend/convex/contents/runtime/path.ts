/** Normalizes one route prefix before using it in indexed reads. */
export function normalizeRoutePrefix(prefix: string) {
  return prefix.split("/").filter(Boolean).join("/");
}

/** Checks exact-or-descendant route membership without sibling prefix bleed. */
export function matchesRouteSegmentPrefix(route: string, prefix: string) {
  if (prefix === "") {
    return true;
  }

  return route === prefix || route.startsWith(`${prefix}/`);
}
