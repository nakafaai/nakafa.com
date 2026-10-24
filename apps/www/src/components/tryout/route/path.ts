import { linkOptions } from "@tanstack/react-router";
import { Array as Arr, Option, Schema } from "effect";
import type { TryoutSectionRoute } from "@/components/tryout/section/model";
import type { LinkTarget } from "@/lib/routing/link";
import { TRYOUT_TARGET } from "@/lib/routing/target";
import { LOCALE_ROUTE } from "@/lib/routing/tree";

/** Route coordinates of an href; each one is optional because a href can omit any of them. */
type TryoutHrefInput = Partial<
  Pick<TryoutSectionRoute, "country" | "exam" | "section" | "set" | "track">
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
  section,
  set,
  track,
}: TryoutHrefInput) {
  const segments = Arr.filter(
    ["try-out", country, exam, track, set, section],
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
 * the country, exam, track, set and section, in that order, so the depth of the
 * path picks the route. An empty segment, or a path of any other shape, names no
 * try-out page and has no target.
 */
export function getTryoutPublicPathTarget(
  publicPath: string
): Option.Option<LinkTarget> {
  const [root, country, exam, track, set, section, ...rest] =
    publicPath.split("/");
  if (
    root !== "try-out" ||
    rest.length > 0 ||
    Arr.some([country, exam, track, set, section], (segment) => segment === "")
  ) {
    return Option.none();
  }
  if (country === undefined) {
    return Option.some(TRYOUT_TARGET);
  }
  if (exam === undefined) {
    return Option.some(
      linkOptions({
        from: LOCALE_ROUTE,
        params: { country },
        to: "/$locale/try-out/$country",
      })
    );
  }
  if (track === undefined) {
    return Option.some(
      linkOptions({
        from: LOCALE_ROUTE,
        params: { country, exam },
        to: "/$locale/try-out/$country/$exam",
      })
    );
  }
  if (set === undefined) {
    return Option.some(
      linkOptions({
        from: LOCALE_ROUTE,
        params: { country, exam, track },
        to: "/$locale/try-out/$country/$exam/$track",
      })
    );
  }
  if (section === undefined) {
    return Option.some(
      linkOptions({
        from: LOCALE_ROUTE,
        params: { country, exam, set, track },
        to: "/$locale/try-out/$country/$exam/$track/$set",
      })
    );
  }
  return Option.some(
    linkOptions({
      from: LOCALE_ROUTE,
      params: { country, exam, section, set, track },
      to: "/$locale/try-out/$country/$exam/$track/$set/$section",
    })
  );
}

/**
 * The typed target of a set or a section of try-out, carrying the attempt that
 * binds navigation to one owned attempt. Only those two routes accept the
 * attempt capability as a search param, so any other path has no target.
 */
function getTryoutAttemptTarget(
  publicPath: string,
  attemptId: string
): Option.Option<LinkTarget> {
  const [root, country, exam, track, set, section, ...rest] =
    publicPath.split("/");
  if (
    root !== "try-out" ||
    !country ||
    !exam ||
    !track ||
    !set ||
    rest.length > 0
  ) {
    return Option.none();
  }
  if (!section) {
    return Option.some(
      linkOptions({
        from: LOCALE_ROUTE,
        params: { country, exam, set, track },
        search: { [ATTEMPT_ID_PARAM]: attemptId },
        to: "/$locale/try-out/$country/$exam/$track/$set",
      })
    );
  }
  return Option.some(
    linkOptions({
      from: LOCALE_ROUTE,
      params: { country, exam, section, set, track },
      search: { [ATTEMPT_ID_PARAM]: attemptId },
      to: "/$locale/try-out/$country/$exam/$track/$set/$section",
    })
  );
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

/** Builds a route capability that binds navigation to one owned attempt. */
export function getTryoutAttemptHref(publicPath: string, attemptId: string) {
  const searchParams = new URLSearchParams({ [ATTEMPT_ID_PARAM]: attemptId });
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
