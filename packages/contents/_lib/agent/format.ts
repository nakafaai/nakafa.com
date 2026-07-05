/** Formats an agent-facing title from a Nakafa route. */
export function formatNakafaRouteTitle(route: string) {
  return route
    .split("/")
    .filter(Boolean)
    .slice(1)
    .map(formatNakafaRouteSegment)
    .join(" / ");
}

/** Formats one slug segment as a compact display label. */
function formatNakafaRouteSegment(segment: string) {
  return segment.split("-").filter(Boolean).map(capitalizeWord).join(" ");
}

/** Capitalizes one slug word without changing the rest of the word. */
function capitalizeWord(word: string) {
  return `${word.charAt(0).toUpperCase()}${word.slice(1)}`;
}
