"use client";

import {
  DEFAULT_LOCALE,
  decodeLocale,
  type Locale,
} from "@repo/internationalization/src/locale";
import {
  type ActiveOptions,
  createLink,
  type FileRoutesByPath,
  type LinkComponentProps,
  type LinkOptions,
  type RegisteredRouter,
  type RemoveTrailingSlashes,
  useMatches,
  useParams,
} from "@tanstack/react-router";
import { Array as Arr, Option } from "effect";
import type { ComponentProps } from "react";
import { isPrerenderedRouteTarget } from "@/lib/routing/prerendered";
import { EXACT_ACTIVE_OPTIONS, type LOCALE_ROUTE } from "@/lib/routing/tree";

/**
 * Every full path of the app's route tree, as the router spells a `to`. The
 * generated tree augments `FileRoutesByPath`, which the app's router registers.
 */
type AppRoutePath = RemoveTrailingSlashes<
  {
    [Id in keyof FileRoutesByPath]: FileRoutesByPath[Id]["fullPath"];
  }[keyof FileRoutesByPath]
>;

/**
 * A typed link target of the app: `linkOptions` of one route, with its params
 * and search. A target of the locale tree leaves `locale` out, because the link
 * fills it from the matched route of the page it is on.
 */
export type LinkTarget = {
  [To in AppRoutePath]: LinkOptions<RegisteredRouter, typeof LOCALE_ROUTE, To>;
}[AppRoutePath];

/**
 * The locale of the page on screen, read from its matched route. A page outside
 * the locale tree, such as a school page, reads the default locale. Only the
 * Convex arguments of a page need it, because a link fills its own locale.
 */
export function useCurrentLocale(): Locale {
  const locale = useParams({
    select: (params) => params.locale,
    strict: false,
  });
  return Option.getOrElse(decodeLocale(locale), () => DEFAULT_LOCALE);
}

/** When a link preloads its route, as the router declares it. */
export type LinkPreload = NonNullable<
  LinkOptions<RegisteredRouter, typeof LOCALE_ROUTE, string>["preload"]
>;

/** A route path without its trailing slash, the one spelling the router compares. */
function withoutTrailingSlash(path: string) {
  return path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
}

/**
 * Whether the page on screen sits on a route, or on one below it. The router's
 * own matches decide it, so a caller never compares paths. The caller names the
 * rule: `exact` asks for the page itself, and `exact: false` also accepts a
 * section that holds it.
 */
export function useRouteMatched(
  to: string | undefined,
  { exact }: { readonly exact: boolean }
) {
  return useMatches({
    select: (matches) => {
      if (to === undefined) {
        return false;
      }
      const route = withoutTrailingSlash(to);
      const paths = Arr.map(matches, (match) =>
        withoutTrailingSlash(match.fullPath)
      );
      return exact
        ? Option.exists(Arr.last(paths), (path) => path === route)
        : Arr.contains(paths, route);
    },
  });
}

/** The full path of the leaf route on screen, as the router spells it without a trailing slash. */
export function useLeafRoutePath() {
  return useMatches({
    select: (matches) =>
      Option.match(Arr.last(matches), {
        onNone: () => "/",
        onSome: (match) => withoutTrailingSlash(match.fullPath),
      }),
  });
}

/** The anchor that every app link renders. The router sets its href, active state and preload handlers. */
function LinkAnchor(props: ComponentProps<"a">) {
  return <a {...props} />;
}

const RouterLink = createLink(LinkAnchor);

/**
 * The one link of the app: the router's typed Link. It takes the `to`, `params`
 * and `search` of the route tree, and fills the locale of a locale route from
 * the page on screen. Its active state is exact unless the caller names another
 * rule, and it is the router's own, so no caller compares paths. A link to a
 * prerendered page loads the page as a document, so no client loader runs for it.
 */
export function Link<const TTo extends string | undefined = undefined>(
  props: LinkComponentProps<"a", RegisteredRouter, typeof LOCALE_ROUTE, TTo>
) {
  return (
    <RouterLink
      activeOptions={EXACT_ACTIVE_OPTIONS}
      reloadDocument={isPrerenderedRouteTarget(props.to)}
      {...props}
    />
  );
}

/**
 * A link to a target that a producer chose at runtime, such as a breadcrumb,
 * a card row or a search result. The producer's target is a typed union of
 * `linkOptions`, which the router's Link cannot take in one JSX spread, so this
 * one component spreads it into the router's Link. Each member keeps the typing
 * of the route it names, and no caller writes a path string.
 */
export function TargetLink({
  activeOptions = EXACT_ACTIVE_OPTIONS,
  hash,
  preload,
  target,
  ...anchor
}: Omit<ComponentProps<"a">, "href" | "target"> & {
  readonly activeOptions?: ActiveOptions | undefined;
  /** The fragment of the page that the link opens, without its `#`. */
  readonly hash?: string | undefined;
  readonly preload?: LinkPreload | undefined;
  readonly target: LinkTarget;
}) {
  return (
    <Link
      {...anchor}
      activeOptions={activeOptions}
      {...(hash === undefined ? {} : { hash })}
      {...(preload === undefined ? {} : { preload })}
      {...target}
    />
  );
}
