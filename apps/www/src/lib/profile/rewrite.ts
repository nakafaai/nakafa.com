import { decodeLocale } from "@repo/internationalization/src/locale";
import { withPathname } from "@repo/internationalization/src/rewrite";
import { Array as Arr, Option } from "effect";
import {
  PROFILE_ROUTE_SEGMENT,
  PROFILE_SIGN,
  SETTINGS_SEGMENT,
} from "@/lib/profile/href";
import { isProfileTab, readProfileRoot } from "@/lib/profile/route";

/** A profile address that the browser asks for: `/{locale}/@{username}` and its tab. */
function readPublicAddress(pathname: string) {
  const [, localeSegment, root = "", ...tab] = pathname.split("/");
  return Option.all([decodeLocale(localeSegment), readProfileRoot(root)]).pipe(
    Option.filter(() => isProfileTab(tab)),
    Option.map(([locale, username]) => ({ locale, tab, username }))
  );
}

/**
 * A profile address of the router: `/{locale}/user/{username}` and its tab. The
 * settings page is the one fixed page below `user`, so it names no profile.
 */
function readRouterAddress(pathname: string) {
  const [, localeSegment, root = "", username = "", ...tab] =
    pathname.split("/");
  if (
    root !== PROFILE_ROUTE_SEGMENT ||
    username === "" ||
    username === SETTINGS_SEGMENT ||
    !isProfileTab(tab)
  ) {
    return Option.none();
  }
  return Option.map(decodeLocale(localeSegment), (locale) => ({
    locale,
    tab,
    username,
  }));
}

/** Joins a locale, the first segment after it and the tab segments into a path. */
function joinPath(locale: string, root: string, tab: readonly string[]) {
  return Arr.join(["", locale, root, ...tab], "/");
}

/** Maps `/{locale}/@{username}` and its tab to the router's `/{locale}/user/{username}`. */
function toRouterPath(pathname: string) {
  return Option.match(readPublicAddress(pathname), {
    onNone: () => pathname,
    onSome: ({ locale, tab, username }) =>
      joinPath(locale, `${PROFILE_ROUTE_SEGMENT}/${username}`, tab),
  });
}

/** Maps the router's `/{locale}/user/{username}` and its tab back to `/{locale}/@{username}`. */
function toPublicPath(pathname: string) {
  return Option.match(readRouterAddress(pathname), {
    onNone: () => pathname,
    onSome: ({ locale, tab, username }) =>
      joinPath(locale, `${PROFILE_SIGN}${username}`, tab),
  });
}

/**
 * Maps the address of a profile to the router's path of the same profile, and
 * back in the output. A path that names no profile keeps its spelling.
 */
export const profileRewrite = {
  input: ({ url }: { url: URL }) =>
    withPathname(url, toRouterPath(url.pathname)),
  output: ({ url }: { url: URL }) =>
    withPathname(url, toPublicPath(url.pathname)),
};
