import {
  decodeLocale,
  type Locale,
} from "@repo/internationalization/src/locale";
import {
  publicSegment,
  readCanonicalName,
  readCanonicalSpelling,
} from "@repo/internationalization/src/pathnames";
import { Array as Arr, HashSet, Option } from "effect";

/**
 * One rewrite function, as `createRouter({ rewrite })` calls it. It returns a
 * new URL and never changes the URL it receives.
 */
type RewriteFunction = ({ url }: { url: URL }) => URL;

/** One router rewrite: the input maps a browser URL to the router's URL, and the output maps back. */
interface RouteRewrite {
  readonly input: RewriteFunction;
  readonly output: RewriteFunction;
}

/**
 * The first path segments that every host answers the same way, so a school
 * host never rewrites them into the school tree.
 */
const SHARED_FIRST_SEGMENTS = HashSet.fromIterable([
  ".well-known",
  "_nakafa",
  "_not-found",
  "_serverFn",
  "api",
  "assets",
  "llms.mdx",
  "mcp",
  "og",
  "sitemap",
]);

/** The root files that every host answers the same way. */
const SHARED_ROOT_FILES = HashSet.fromIterable([
  "/e22d548f7fd2482a9022e3b84e944901.txt",
  "/llms.txt",
  "/logo.svg",
  "/manifest.webmanifest",
  "/robots.txt",
  "/rss.xml",
  "/sitemap.txt",
  "/sitemap.xml",
  "/skill.md",
]);

/** Whether a path belongs to a shared route that no school host rewrites. */
export function isSharedPath(pathname: string) {
  return (
    HashSet.has(SHARED_ROOT_FILES, pathname) ||
    Option.exists(Arr.get(pathname.split("/"), 1), (segment) =>
      HashSet.has(SHARED_FIRST_SEGMENTS, segment)
    )
  );
}

/** A copy of a URL with another path. The URL that the router passed in stays unchanged. */
export function withPathname(url: URL, pathname: string) {
  const next = new URL(url);
  next.pathname = pathname;
  return next;
}

/**
 * Rewrites the second segment of a path that starts with a locale, such as
 * `/id/materi/x`. A path without a locale, or whose second segment the rewrite
 * does not know, keeps its spelling.
 */
function rewriteLocaleSegment(
  pathname: string,
  rewrite: (locale: Locale, segment: string) => Option.Option<string>
): string {
  const segments = pathname.split("/");
  const rewritten = Option.all([
    Option.flatMap(Arr.get(segments, 1), decodeLocale),
    Arr.get(segments, 2),
  ]).pipe(Option.flatMap(([locale, segment]) => rewrite(locale, segment)));
  return Option.match(rewritten, {
    onNone: () => pathname,
    onSome: (segment) =>
      Arr.join(
        [...Arr.take(segments, 2), segment, ...Arr.drop(segments, 3)],
        "/"
      ),
  });
}

/** The router's path of a public path: a localized second segment becomes its canonical name. */
export function toCanonicalPath(pathname: string): string {
  return rewriteLocaleSegment(pathname, (locale, spelling) =>
    Option.map(
      readCanonicalSpelling(locale, spelling),
      (canonical) => canonical
    )
  );
}

/** The public path of a router path: a canonical second segment becomes its spelling in the locale. */
export function toPublicPath(pathname: string): string {
  return rewriteLocaleSegment(pathname, (locale, name) =>
    Option.map(readCanonicalName(name), (canonical) =>
      publicSegment(canonical, locale)
    )
  );
}

/** Maps `/id/materi/x` to the router's `/id/materials/x`, and back in the output. */
export const localeRewrite = {
  input: ({ url }: { url: URL }) =>
    withPathname(url, toCanonicalPath(url.pathname)),
  output: ({ url }: { url: URL }) =>
    withPathname(url, toPublicPath(url.pathname)),
} satisfies RouteRewrite;
