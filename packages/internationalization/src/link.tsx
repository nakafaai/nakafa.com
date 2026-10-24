"use client";

import {
  isInternalHref,
  localizeInternalHref,
  splitLocalePathname,
} from "@repo/internationalization/src/href";
import {
  DEFAULT_LOCALE,
  decodeLocale,
  LOCALES,
  type Locale,
} from "@repo/internationalization/src/locale";
import {
  type ActiveOptions,
  createLink,
  type FileRoutesByPath,
  type LinkOptions,
  type RegisteredRouter,
  useLocation,
  useNavigate,
  useParams,
} from "@tanstack/react-router";
import { Array as Arr, Option } from "effect";
import type { ComponentProps, ComponentPropsWithoutRef } from "react";

/**
 * Every route of the app as a link target: one `linkOptions({ to, params })` of
 * a route in the route tree. Where the app's route tree is not registered, as in
 * this package's own check, a target names any path.
 */
export type LinkTarget = [keyof FileRoutesByPath] extends [never]
  ? LinkOptions<RegisteredRouter, string, string>
  : {
      [To in keyof FileRoutesByPath]: LinkOptions<
        RegisteredRouter,
        string,
        To & string
      >;
    }[keyof FileRoutesByPath];

/** When a link preloads its route, as the router declares it. */
type LinkPreload = NonNullable<
  LinkOptions<RegisteredRouter, string, string>["preload"]
>;

/** The anchor that every app link renders; the router sets its href, its active state and its preload handlers. */
function LinkAnchor(props: ComponentProps<"a">) {
  return <a {...props} />;
}

/** A link to a route of the app. Its `to`, `params` and `search` are typed by the route tree. */
export const Link = createLink(LinkAnchor);

/** The active rule of a navigation link: its own page only, whatever the search, so a section link stays unmarked on nested pages. */
export const EXACT_ACTIVE_OPTIONS: ActiveOptions = {
  exact: true,
  includeSearch: false,
};

/** The locale of the page on screen. A page outside the locale tree, such as a school page, reads the default locale. */
export function useCurrentLocale(): Locale {
  const locale = useParams({
    select: (params) => params.locale,
    strict: false,
  });
  return Option.getOrElse(decodeLocale(locale), () => DEFAULT_LOCALE);
}

/**
 * A link to a path of the app that the route tree cannot type: a path the
 * content or the route map gives, in any spelling, with or without its locale.
 * The link leads the path with the locale of the page on screen, and the router
 * maps the public spelling to its route. A path outside the app, or a link that
 * opens another target, renders as a plain anchor, which keeps its locale.
 */
export function HrefLink({
  activeOptions = EXACT_ACTIVE_OPTIONS,
  href,
  preload,
  target,
  ...anchor
}: Omit<ComponentPropsWithoutRef<"a">, "href" | "target"> & {
  readonly activeOptions?: ActiveOptions | undefined;
  readonly href: string;
  readonly preload?: LinkPreload | undefined;
  readonly target?: string | undefined;
}) {
  const locale = useCurrentLocale();
  if (!isInternalHref(href)) {
    return <a {...anchor} href={href} target={target} />;
  }
  const localized = localizeInternalHref(href, locale);
  if (target !== undefined) {
    return <a {...anchor} href={localized} target={target} />;
  }
  return (
    <Link<RegisteredRouter, string, string>
      {...anchor}
      activeOptions={activeOptions}
      href={localized}
      {...(preload !== undefined && { preload })}
    />
  );
}

/**
 * Navigates to a path of the app that the route tree cannot type, on the locale
 * of the page on screen. A replace takes the place of the current entry. An href
 * that leaves the app loads as a full document, as a plain link does.
 */
export function useHrefNavigate() {
  const locale = useCurrentLocale();
  const navigate = useNavigate();
  return (href: string, options?: { readonly replace?: boolean }) => {
    const replace = options?.replace ?? false;
    if (!isInternalHref(href)) {
      if (replace) {
        window.location.replace(href);
      } else {
        window.location.assign(href);
      }
      return;
    }
    navigate({ href: localizeInternalHref(href, locale), replace });
  };
}

/** The pathname of the page on screen without its locale, in the router's spelling, such as `/curricula/merdeka`. */
export function useCanonicalPath() {
  return useLocation({
    select: (location) => {
      const { publicSegments } = splitLocalePathname(
        location.pathname,
        LOCALES
      );
      return Arr.isReadonlyArrayNonEmpty(publicSegments)
        ? `/${Arr.join(publicSegments, "/")}`
        : "/";
    },
  });
}

/** A link to a route target that the route tree types, with the exact active rule by default. */
export function DestinationLink({
  activeOptions = EXACT_ACTIVE_OPTIONS,
  destination,
  preload,
  ...anchor
}: Omit<ComponentPropsWithoutRef<"a">, "href" | "target"> & {
  readonly activeOptions?: ActiveOptions | undefined;
  readonly destination: LinkTarget;
  readonly preload?: LinkPreload | undefined;
}) {
  return (
    <Link
      {...anchor}
      activeOptions={activeOptions}
      {...(preload !== undefined && { preload })}
      {...destination}
    />
  );
}
