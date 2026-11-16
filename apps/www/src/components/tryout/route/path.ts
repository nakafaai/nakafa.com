import { Array as Arr, Option, Schema } from "effect";
import { PLAYER_MODE_PARAM } from "@/components/player/mode";
import type { TryoutSectionRoute } from "@/components/tryout/section/model";
import type { LinkTarget } from "@/lib/routing/link";
import { TRYOUT_TARGET } from "@/lib/routing/target";
import { LOCALE_ROUTE } from "@/lib/routing/tree";

/** Route coordinates of an href; each one is optional because a href can omit any of them. */
type TryoutHrefInput = Partial<
  Pick<
    TryoutSectionRoute,
    "country" | "exam" | "group" | "section" | "set" | "track"
  >
>;

const ATTEMPT_ID_PARAM = "attemptId";

export type TryoutRouteSearchParams = Readonly<
  Record<string, string | readonly string[] | undefined>
>;

const TryoutAttemptCapabilitySchema = Schema.Union([
  Schema.Struct({ kind: Schema.Literal("absent") }),
  Schema.Struct({ kind: Schema.Literal("invalid") }),
  Schema.Struct({ attemptId: Schema.String, kind: Schema.Literal("valid") }),
]);

type TryoutAttemptCapability = typeof TryoutAttemptCapabilitySchema.Type;

/** The public path of a try-out address, such as `try-out/indonesia/snbt`, without its leading slash. */
export function getTryoutPublicPath({
  country,
  exam,
  group,
  section,
  set,
  track,
}: TryoutHrefInput) {
  const segments = Arr.filter(
    ["try-out", country, exam, group, track, set, section],
    (segment): segment is string => Boolean(segment)
  );

  return Arr.join(segments, "/");
}

/** Builds a public try-out href from already-localized route segments. */
export function getTryoutHref(input: TryoutHrefInput = {}) {
  return `/${getTryoutPublicPath(input)}`;
}

/** Converts a Convex publicPath row into the href expected by localized links. */
export function getTryoutPublicPathHref(publicPath: string) {
  return `/${publicPath}`;
}

/**
 * The typed target of a try-out public path. Its segments after `try-out` name
 * the country, exam, group, track, set and section, in that order, so the depth
 * of the path picks the route. An exam has no page of its own: a link to it
 * lands on its first group, so an exam path has no target. An empty segment, or
 * a path of any other shape, names no try-out page and has no target either.
 */
export function getTryoutPublicPathTarget(
  publicPath: string
): Option.Option<LinkTarget> {
  const [root, country, exam, group, track, set, section, ...rest] =
    publicPath.split("/");
  if (
    root !== "try-out" ||
    rest.length > 0 ||
    Arr.some(
      [country, exam, group, track, set, section],
      (segment) => segment === ""
    )
  ) {
    return Option.none();
  }
  if (country === undefined) {
    return Option.some(TRYOUT_TARGET);
  }
  if (exam === undefined) {
    return Option.some({
      from: LOCALE_ROUTE,
      params: { country },
      to: "/$locale/try-out/$country",
    } satisfies LinkTarget);
  }
  if (group === undefined) {
    return Option.none();
  }
  if (track === undefined) {
    return Option.some({
      from: LOCALE_ROUTE,
      params: { country, exam, group },
      to: "/$locale/try-out/$country/$exam/$group",
    } satisfies LinkTarget);
  }
  if (set === undefined) {
    return Option.some({
      from: LOCALE_ROUTE,
      params: { country, exam, group, track },
      to: "/$locale/try-out/$country/$exam/$group/$track",
    } satisfies LinkTarget);
  }
  if (section === undefined) {
    return Option.some({
      from: LOCALE_ROUTE,
      params: { country, exam, group, set, track },
      to: "/$locale/try-out/$country/$exam/$group/$track/$set",
    } satisfies LinkTarget);
  }
  return Option.some({
    from: LOCALE_ROUTE,
    params: { country, exam, group, section, set, track },
    to: "/$locale/try-out/$country/$exam/$group/$track/$set/$section",
  } satisfies LinkTarget);
}

/**
 * The typed target of a set or a section of try-out with one search value: only those two routes accept a
 * search beyond the catalog's, so any other path has no target.
 */
function setOrSectionTarget(
  publicPath: string,
  search: Readonly<Record<string, string>>
): Option.Option<LinkTarget> {
  const [root, country, exam, group, track, set, section, ...rest] =
    publicPath.split("/");
  if (
    root !== "try-out" ||
    !country ||
    !exam ||
    !group ||
    !track ||
    !set ||
    rest.length > 0
  ) {
    return Option.none();
  }
  if (!section) {
    return Option.some({
      from: LOCALE_ROUTE,
      params: { country, exam, group, set, track },
      search,
      to: "/$locale/try-out/$country/$exam/$group/$track/$set",
    } satisfies LinkTarget);
  }
  return Option.some({
    from: LOCALE_ROUTE,
    params: { country, exam, group, section, set, track },
    search,
    to: "/$locale/try-out/$country/$exam/$group/$track/$set/$section",
  } satisfies LinkTarget);
}

/** The target of a set or a section of try-out bound to one owned attempt. */
function getTryoutAttemptTarget(publicPath: string, attemptId: string) {
  return setOrSectionTarget(publicPath, { [ATTEMPT_ID_PARAM]: attemptId });
}

/** The search value that opens a set's or a section's practice in place of its try-out (ADR 0044). */
export const PRACTICE_SEARCH = { mode: "practice" } as const;

/** The target of the practice of a set or a section of try-out. */
export function getTryoutPracticeTarget(publicPath: string) {
  return setOrSectionTarget(publicPath, PRACTICE_SEARCH);
}

/**
 * The breadcrumb target of one try-out public path, or none when the path names
 * no try-out page. A breadcrumb with no target is the current page.
 */
export function getTryoutCrumbTarget(
  publicPath: string
): Option.Option<LinkTarget> {
  return getTryoutPublicPathTarget(publicPath);
}

/** The address of one try-out page: its public path, and the attempt that binds the page when one is open. */
export const TryoutPageAddressSchema = Schema.Struct({
  attemptId: Schema.optionalKey(Schema.String),
  publicPath: Schema.String,
});

export type TryoutPageAddress = typeof TryoutPageAddressSchema.Type;

/** The typed target of a try-out page address, or none when the address names no page. */
export function getTryoutPageTarget({
  attemptId,
  publicPath,
}: {
  readonly attemptId?: string | undefined;
  readonly publicPath: string;
}): Option.Option<LinkTarget> {
  return attemptId === undefined
    ? getTryoutPublicPathTarget(publicPath)
    : getTryoutAttemptTarget(publicPath, attemptId);
}

/**
 * Builds a route capability that binds navigation to one owned attempt, with the player view the
 * address keeps when it names one.
 */
export function getTryoutAttemptHref(
  publicPath: string,
  attemptId: string,
  view: Option.Option<string> = Option.none()
) {
  const searchParams = new URLSearchParams({ [ATTEMPT_ID_PARAM]: attemptId });
  Option.map(view, (mode) => searchParams.set(PLAYER_MODE_PARAM, mode));
  return `${getTryoutPublicPathHref(publicPath)}?${searchParams.toString()}`;
}

/** The address-bar href of one try-out page, for a URL that carries the page as text, such as an auth redirect. */
export function getTryoutPageHref({
  attemptId,
  publicPath,
}: TryoutPageAddress) {
  return attemptId === undefined
    ? getTryoutPublicPathHref(publicPath)
    : getTryoutAttemptHref(publicPath, attemptId);
}

/**
 * The lock a running attempt's pages hold, as the shell remembers it for a reload: the attempt
 * capability that names those pages, until the attempt ends.
 */
export function getTryoutAttemptLock(attemptId: string, until: number) {
  return { name: ATTEMPT_ID_PARAM, until, value: attemptId };
}

/** Preserves an exact attempt capability, and the view the address names, through localized authentication. */
export function getTryoutAttemptAuthHref(
  locale: string,
  publicPath: string,
  attemptId: string,
  view: Option.Option<string> = Option.none()
) {
  const redirectHref = `/${locale}${getTryoutAttemptHref(publicPath, attemptId, view)}`;
  return `/${locale}/auth?redirect=${encodeURIComponent(redirectHref)}`;
}

/** The sign-in address that comes back to the practice of a set or a section. */
export function getTryoutPracticeAuthHref(locale: string, publicPath: string) {
  const redirectHref = `/${locale}${getTryoutPublicPathHref(publicPath)}?${new URLSearchParams(PRACTICE_SEARCH).toString()}`;
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
