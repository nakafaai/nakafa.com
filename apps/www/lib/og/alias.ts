import { decodeLocale } from "@repo/internationalization/src/locale";
import { Array as Arr, Option } from "effect";

/**
 * The suffixes that address one social image, longest first: the `image.png`
 * file of a route, and the `.png` or `.og` extension of a public alias.
 */
const IMAGE_SUFFIXES = ["/image.png", ".png", ".og"] as const;

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
 * drops its suffix, so the image route answers the route that it names. An
 * alias under a locale shape that the site does not serve is not rewritten, so
 * the router answers it with not found.
 */
export function readOgAliasUrl(url: URL): Option.Option<URL> {
  const { pathname } = url;
  if (pathname === "/og" || pathname.startsWith("/og/")) {
    return Option.none();
  }
  const [firstSegment] = Arr.filter(
    pathname.split("/"),
    (segment) => segment !== ""
  );
  return Option.flatMap(readImageSuffix(pathname), (suffix) => {
    if (isUnservedLocaleShape(firstSegment)) {
      return Option.none();
    }
    const alias = new URL(url);
    alias.pathname = `/og/${pathname.slice(1, -suffix.length)}`;
    return Option.some(alias);
  });
}
