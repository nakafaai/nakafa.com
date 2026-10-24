import { decodeLocale } from "@repo/internationalization/src/locale";
import { Array as Arr, Option } from "effect";

/**
 * The suffixes that address one social image through a public alias: the `.png`
 * extension and the `.og` extension of a route.
 */
const IMAGE_SUFFIXES = [".png", ".og"] as const;

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
 * Reads the `/og` address that a public social image alias serves. The alias
 * drops its suffix, so the image route answers the route that it names. A path
 * that the static assets serve, such as `/og.png`, is answered before the server
 * entry runs, so the alias never sees it. An alias under a locale shape
 * that the site does not serve is not rewritten, so the router answers it with not
 * found. A path that already names the OG route, bare or under a served locale, is
 * not rewritten either.
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
    alias.pathname = `/og/${pathname.slice(1, -suffix.length)}`;
    return Option.some(alias);
  });
}

/**
 * The request that a social image alias serves, as the OG route receives it: the
 * same method, headers and query on the route's address. Only a read of the
 * image is an alias, so any other method reaches the router unchanged.
 */
export function readOgAliasRequest(request: Request): Option.Option<Request> {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return Option.none();
  }
  return Option.map(
    readOgAliasUrl(new URL(request.url)),
    (alias) => new Request(alias, request)
  );
}
