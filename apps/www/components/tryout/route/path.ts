import { Array as Arr, Schema } from "effect";
import type { TryoutSectionRoute } from "@/components/tryout/section/model";

/** Route coordinates of an href; each one is optional because a href can omit any of them. */
type TryoutHrefInput = Partial<
  Pick<TryoutSectionRoute, "country" | "exam" | "section" | "set" | "track">
>;

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

type TryoutAttemptCapability = typeof TryoutAttemptCapabilitySchema.Type;

/** Builds a public try-out href from already-localized route segments. */
export function getTryoutHref({
  country,
  exam,
  section,
  set,
  track,
}: TryoutHrefInput = {}) {
  const segments = Arr.filter(
    ["try-out", country, exam, track, set, section],
    (segment): segment is string => Boolean(segment)
  );

  return `/${Arr.join(segments, "/")}`;
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
function readTryoutAttemptCapability(
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
