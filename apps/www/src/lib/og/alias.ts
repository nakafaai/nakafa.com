import {
  DEFAULT_LOCALE,
  decodeLocale,
} from "@repo/internationalization/src/locale";
import { Array as Arr, Option } from "effect";

/**
 * The suffixes that address one social image through a public alias: the `.png`
 * extension and the `.og` extension of a route.
 */
const IMAGE_SUFFIXES = [".png", ".og"] as const;

/** The status of a permanent redirect that keeps the method of the request. */
const PERMANENT_REDIRECT = 308;

/** Two ASCII letters, the shape of every locale code. */
const LOCALE_SHAPE = /^[A-Za-z]{2}$/;

/** Reads the image suffix that a path ends with, ignoring case, or none for any other path. */
export function readImageSuffix(path: string): Option.Option<string> {
  const lowerPath = path.toLowerCase();
  return Arr.findFirst(IMAGE_SUFFIXES, (suffix) => lowerPath.endsWith(suffix));
}

/**
 * Reports whether a segment has the shape of a locale that the site does not
 * serve. Such a segment names no route, so the social image of its path
 * answers the brand fallback and never the copy of another route.
 */
export function isUnservedLocaleShape(segment: string | undefined) {
  return (
    segment !== undefined &&
    LOCALE_SHAPE.test(segment) &&
    Option.isNone(decodeLocale(segment))
  );
}

/**
 * Reads the static social image that an alias names. The alias drops its suffix,
 * and the address of the image that the build wrote for that route takes its
 * place, with the locale that the path names or the default locale for a path
 * without one. The query is kept. A path that the static assets serve, such as
 * `/og.png`, is answered before the server entry runs, so the alias never sees
 * it. An alias under a locale shape that the site does not serve is not
 * rewritten, and neither is a path that already names an image of the OG tree.
 */
export function readOgAliasUrl(url: URL): Option.Option<URL> {
  const { pathname } = url;
  const [firstSegment, secondSegment] = Arr.filter(
    pathname.split("/"),
    (segment) => segment !== ""
  );
  if (
    firstSegment === "og" ||
    (secondSegment === "og" && Option.isSome(decodeLocale(firstSegment)))
  ) {
    return Option.none();
  }
  return Option.flatMap(readImageSuffix(pathname), (suffix) => {
    if (isUnservedLocaleShape(firstSegment)) {
      return Option.none();
    }
    const alias = new URL(url);
    alias.pathname = `/${readImagePath(pathname.slice(1, -suffix.length))}`;
    return Option.some(alias);
  });
}

/**
 * The path of the image file that the build wrote for an alias path, such as
 * `en/og/subject/biology/image.png`. The home image has no route segments.
 */
function readImagePath(aliasPath: string) {
  const segments = Arr.filter(aliasPath.split("/"), (part) => part !== "");
  const [first = "", ...rest] = segments;
  const locale = decodeLocale(first);
  const slug = Option.isSome(locale) ? rest : segments;
  return Arr.join(
    [
      Option.getOrElse(locale, () => DEFAULT_LOCALE),
      "og",
      ...slug,
      "image.png",
    ],
    "/"
  );
}

/**
 * The permanent redirect of a read of a social image alias to the image that the
 * build wrote for its route. The method and the query are kept. Only a read is an
 * alias, so any other method reaches the router unchanged.
 */
export function readOgAliasRedirect(request: Request): Option.Option<Response> {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return Option.none();
  }
  return Option.map(readOgAliasUrl(new URL(request.url)), (target) =>
    Response.redirect(target.href, PERMANENT_REDIRECT)
  );
}
