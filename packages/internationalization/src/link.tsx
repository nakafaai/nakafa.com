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

/**
 * Every full path of the app's route tree, as the router spells a `to`. The
 * generated tree augments `FileRoutesByPath`, so this union is empty until the
 * app registers its router. A package that links nothing types nothing.
 */
export type AppRoutePath = RemoveTrailingSlashes<
  {
    [Id in keyof FileRoutesByPath]: FileRoutesByPath[Id]["fullPath"];
  }[keyof FileRoutesByPath]
>;

/**
 * The route that holds the locale of every page. It is the `from` of every
 * link, so TanStack types the locale of a target of this tree as optional, and
 * a link that names no locale inherits the one of the page on screen.
 */
export const LOCALE_ROUTE = "/$locale";

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

/** The active rule of a link to one page: that page only, whatever its search. */
export const EXACT_ACTIVE_OPTIONS = {
  exact: true,
  includeSearch: false,
} satisfies ActiveOptions;

/** A route path without its trailing slash, the one spelling the router compares. */
function withoutTrailingSlash(path: string) {
  return path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
}

/**
 * Whether the page on screen sits on a route, or on one below it. The router's
 * own matches decide it, so a caller never compares paths. `exact` asks for the
 * page itself, not for a section that holds it.
 */
export function useRouteMatched(
  to: string | undefined,
  { exact = false }: { readonly exact?: boolean } = {}
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
export function LinkAnchor(props: ComponentProps<"a">) {
  return <a {...props} />;
}

const RouterLink = createLink(LinkAnchor);

/**
 * The one link of the app: the router's typed Link. It takes the `to`, `params`
 * and `search` of the route tree, and fills the locale of a locale route from
 * the page on screen. Its active state is exact unless the caller names another
 * rule, and it is the router's own, so no caller compares paths.
 */
export function Link<const TTo extends string | undefined = undefined>(
  props: LinkComponentProps<"a", RegisteredRouter, typeof LOCALE_ROUTE, TTo>
) {
  return <RouterLink activeOptions={EXACT_ACTIVE_OPTIONS} {...props} />;
}

/**
 * A link to a target that the app chose at runtime, such as a breadcrumb or a row
 * of a list. The target spreads into the one link, which keeps its own typing.
 */
export function DestinationLink({
  activeOptions = EXACT_ACTIVE_OPTIONS,
  destination,
  preload,
  ...anchor
}: Omit<ComponentProps<"a">, "href" | "target"> & {
  readonly activeOptions?: ActiveOptions | undefined;
  readonly destination: LinkTarget;
  readonly preload?: LinkPreload | undefined;
}) {
  return (
    <Link
      {...anchor}
      activeOptions={activeOptions}
      {...(preload === undefined ? {} : { preload })}
      {...destination}
    />
  );
}
