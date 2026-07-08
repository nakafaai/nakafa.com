interface TryoutHrefInput {
  country?: string;
  exam?: string;
  section?: string;
  set?: string;
  track?: string;
}

/** Builds a public try-out href from already-localized route segments. */
export function getTryoutHref({
  country,
  exam,
  section,
  set,
  track,
}: TryoutHrefInput = {}) {
  const segments = ["try-out", country, exam, track, set, section].filter(
    (segment): segment is string => Boolean(segment)
  );

  return `/${segments.join("/")}`;
}

/** Converts a Convex publicPath row into the href expected by localized links. */
export function getTryoutPublicPathHref(publicPath: string) {
  return `/${publicPath}`;
}
