import { Schema } from "effect";

const TryoutHrefInputSchema = Schema.Struct({
  country: Schema.optionalKey(Schema.String),
  exam: Schema.optionalKey(Schema.String),
  section: Schema.optionalKey(Schema.String),
  set: Schema.optionalKey(Schema.String),
  track: Schema.optionalKey(Schema.String),
});
type TryoutHrefInput = typeof TryoutHrefInputSchema.Type;

const ATTEMPT_ID_PARAM = "attemptId";

export type TryoutRouteSearchParams = Record<
  string,
  string | string[] | undefined
>;

const TryoutAttemptCapabilitySchema = Schema.Union([
  Schema.Struct({ kind: Schema.Literal("absent") }),
  Schema.Struct({ kind: Schema.Literal("invalid") }),
  Schema.Struct({ attemptId: Schema.String, kind: Schema.Literal("valid") }),
]);
export type TryoutAttemptCapability = typeof TryoutAttemptCapabilitySchema.Type;

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

/** Preserves an exact attempt capability through localized authentication. */
export function getTryoutAttemptAuthHref(
  locale: string,
  publicPath: string,
  attemptId: string
) {
  const redirectHref = `/${locale}${getTryoutAttemptHref(publicPath, attemptId)}`;
  return `/${locale}/auth?redirect=${encodeURIComponent(redirectHref)}`;
}

/** Classifies the optional attempt capability carried by server search params. */
export function readTryoutRouteAttemptCapability(
  searchParams: TryoutRouteSearchParams
): TryoutAttemptCapability {
  const value = searchParams[ATTEMPT_ID_PARAM];
  if (value === undefined) {
    return { kind: "absent" };
  }
  if (typeof value !== "string" || value.length === 0) {
    return { kind: "invalid" };
  }
  return { attemptId: value, kind: "valid" };
}

/** Classifies the attempt capability carried by a browser request URL. */
export function readTryoutAttemptCapability(
  searchParams: Pick<URLSearchParams, "getAll">
): TryoutAttemptCapability {
  const attemptIds = searchParams.getAll(ATTEMPT_ID_PARAM);
  if (attemptIds.length === 0) {
    return { kind: "absent" };
  }
  if (attemptIds.length !== 1) {
    return { kind: "invalid" };
  }
  const attemptId = attemptIds[0];
  if (!attemptId) {
    return { kind: "invalid" };
  }
  return { attemptId, kind: "valid" };
}

/** Reports whether one request URL carries one exact attempt capability. */
export function hasTryoutAttemptCapability(searchParams: URLSearchParams) {
  return readTryoutAttemptCapability(searchParams).kind === "valid";
}
