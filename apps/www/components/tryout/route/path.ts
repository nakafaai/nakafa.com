interface TryoutHrefInput {
  country?: string;
  exam?: string;
  section?: string;
  set?: string;
  track?: string;
}

const ATTEMPT_ID_PARAM = "attemptId";

export type TryoutRouteSearchParams = Record<
  string,
  string | string[] | undefined
>;

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

/** Builds a route capability that binds navigation to one owned attempt. */
export function getTryoutAttemptHref(publicPath: string, attemptId: string) {
  const searchParams = new URLSearchParams({ [ATTEMPT_ID_PARAM]: attemptId });
  return `${getTryoutPublicPathHref(publicPath)}?${searchParams.toString()}`;
}

/** Reads the public path from one route href produced by this module. */
export function getTryoutPublicPath(href: string) {
  const searchStart = href.indexOf("?");
  const pathname = searchStart === -1 ? href : href.slice(0, searchStart);
  if (pathname.startsWith("/")) {
    return pathname.slice(1);
  }
  return pathname;
}

/** Preserves an exact attempt capability through localized authentication. */
export function getTryoutAttemptAuthHref(
  locale: string,
  publicPath: string,
  attemptId: string
) {
  const redirectHref = `/${locale}${getTryoutAttemptHref(publicPath, attemptId)}`;
  return `/${locale}/auth?redirect=${encodeURIComponent(redirectHref)}`;
}

/** Reads one untrusted attempt capability for server-side verification. */
export function readTryoutAttemptId(searchParams: TryoutRouteSearchParams) {
  const attemptId = searchParams[ATTEMPT_ID_PARAM];
  if (typeof attemptId !== "string" || attemptId.length === 0) {
    return;
  }
  return attemptId;
}

/** Accepts exactly one non-empty attempt capability from one request URL. */
export function hasTryoutAttemptCapability(searchParams: URLSearchParams) {
  const attemptIds = searchParams.getAll(ATTEMPT_ID_PARAM);
  if (attemptIds.length !== 1) {
    return false;
  }
  return Boolean(attemptIds[0]);
}
