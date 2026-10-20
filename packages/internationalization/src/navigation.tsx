import {
  isInternalHref,
  splitLocalePathname,
} from "@repo/internationalization/src/href";
import {
  DEFAULT_LOCALE,
  type Locale,
} from "@repo/internationalization/src/locale";
import { toPublicPath } from "@repo/internationalization/src/rewrite";
import {
  localizedTarget,
  schoolTarget,
} from "@repo/internationalization/src/target";
import {
  Link as RouterLink,
  redirect as routerRedirect,
  useLocation,
  useNavigate,
  useRouter as useRouterInstance,
} from "@tanstack/react-router";
import { Array as Arr } from "effect";
import type { ComponentProps } from "react";
import { useMemo } from "react";

/** The router pathname of the page on screen, with its locale. */
function useRouterPathname() {
  return useLocation({ select: (location) => location.pathname });
}

/** The locale of the page on screen, or the default locale when its path names none. */
export function useCurrentLocale(): Locale {
  return splitLocalePathname(useRouterPathname()).locale ?? DEFAULT_LOCALE;
}

/**
 * The pathname of the page on screen without its locale, in canonical route
 * spelling, such as `/curricula/merdeka`. Links and this value compare directly.
 */
export function usePathname(): string {
  const { publicSegments } = splitLocalePathname(useRouterPathname());
  const rest = Arr.join(publicSegments, "/");
  return rest === "" ? "/" : `/${rest}`;
}

/** The props of a navigation link: an anchor whose internal href may name another locale and a preload strategy. */
export type NavigationLinkProps = Omit<
  ComponentProps<"a">,
  "href" | "target"
> & {
  href: string;
  locale?: Locale;
  preload?: false | "intent" | "render" | "viewport" | undefined;
  resetScroll?: boolean;
  target?: string | undefined;
};

/**
 * A link to a page of the app on the locale of the page on screen, or on the
 * `locale` it names. A link that leaves the app or opens another target
 * renders as a plain anchor, because the router only moves between pages of
 * this app.
 */
export function Link({
  href,
  locale,
  preload,
  resetScroll,
  target,
  ...anchor
}: NavigationLinkProps) {
  const current = useCurrentLocale();
  if (!isInternalHref(href) || target !== undefined) {
    return <a {...anchor} href={href} target={target} />;
  }
  return (
    <RouterLink
      {...anchor}
      preload={preload ?? "intent"}
      resetScroll={resetScroll ?? true}
      to={localizedTarget(href, locale ?? current)}
    />
  );
}

/**
 * A link inside a school host. The school tree names the school in its path
 * and the host carries no locale, so the link keeps the school of the page on
 * screen and writes no locale.
 */
export function SchoolLink({
  href,
  preload,
  resetScroll,
  target,
  ...anchor
}: NavigationLinkProps) {
  const pathname = useRouterPathname();
  if (!isInternalHref(href) || target !== undefined) {
    return <a {...anchor} href={href} target={target} />;
  }
  return (
    <RouterLink
      {...anchor}
      preload={preload ?? "intent"}
      resetScroll={resetScroll ?? true}
      to={schoolTarget(href, pathname)}
    />
  );
}

/** The navigation of the app on the locale of the page on screen, or on the locale a call names. */
export function useRouter() {
  const navigate = useNavigate();
  const router = useRouterInstance();
  const current = useCurrentLocale();
  return useMemo(
    () => ({
      back: () => router.history.back(),
      forward: () => router.history.forward(),
      prefetch: (href: string, options?: { locale?: Locale }) => {
        router.preloadRoute({
          to: localizedTarget(href, options?.locale ?? current),
        });
      },
      push: (href: string, options?: { locale?: Locale }) => {
        navigate({
          to: localizedTarget(href, options?.locale ?? current),
        });
      },
      refresh: () => {
        router.invalidate();
      },
      replace: (href: string, options?: { locale?: Locale }) => {
        navigate({
          replace: true,
          to: localizedTarget(href, options?.locale ?? current),
        });
      },
    }),
    [current, navigate, router]
  );
}

/** The public path of an internal href on a locale, as the address bar shows it. */
export function getPathname({
  href,
  locale,
}: {
  href: string;
  locale: Locale;
}) {
  return toPublicPath(localizedTarget(href, locale));
}

/**
 * Moves the request to an internal href on a locale, with a 307 unless a
 * status is given. The router answers the throw, so the call never returns.
 */
export function redirect({
  href,
  locale = DEFAULT_LOCALE,
  statusCode = 307,
}: {
  href: string;
  locale?: Locale;
  statusCode?: 301 | 302 | 303 | 307 | 308;
}): never {
  throw routerRedirect({
    statusCode,
    to: localizedTarget(href, locale),
  });
}
