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
  activeOptions,
  href,
  preload,
  target,
  ...anchor
}: Omit<ComponentPropsWithoutRef<"a">, "href" | "target"> & {
  readonly activeOptions?: ActiveOptions | undefined;
  readonly href: string;
  readonly preload?: false | "intent" | "render" | "viewport" | undefined;
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
      {...(activeOptions !== undefined && { activeOptions })}
      href={localized}
      {...(preload !== undefined && { preload })}
    />
  );
}

/**
 * Navigates to a path of the app that the route tree cannot type, on the locale
 * of the page on screen. A replace takes the place of the current entry.
 */
export function useHrefNavigate() {
  const locale = useCurrentLocale();
  const navigate = useNavigate();
  return (href: string, options?: { readonly replace?: boolean }) => {
    navigate({
      href: localizeInternalHref(href, locale),
      replace: options?.replace ?? false,
    });
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

/**
 * A link to a destination: a route target that the route tree types, or a path
 * that the content gives, which `HrefLink` localizes.
 */
export function DestinationLink({
  activeOptions,
  destination,
  preload,
  ...anchor
}: Omit<ComponentPropsWithoutRef<"a">, "href" | "target"> & {
  readonly activeOptions?: ActiveOptions | undefined;
  readonly destination: LinkTarget | string;
  readonly preload?: false | "intent" | "render" | "viewport" | undefined;
}) {
  const options = {
    ...(activeOptions !== undefined && { activeOptions }),
    ...(preload !== undefined && { preload }),
  };
  if (typeof destination === "string") {
    return <HrefLink {...anchor} {...options} href={destination} />;
  }
  return <Link {...anchor} {...options} {...destination} />;
}
