import { splitLocalePathname } from "@repo/internationalization/src/href";
import {
  decodeLocale,
  type Locale,
} from "@repo/internationalization/src/locale";
import { notFound } from "@tanstack/react-router";
import { Array as Arr, Option } from "effect";
import { MAIN_HOST_SCHOOL_PAGES } from "@/lib/ownership/route";

/*
 * The locale of an address of the main site, decided in one place (ADR 0026,
 * ADR 0038 D7). An address names its locale in its first segment. One that names
 * none is bare and moves to the request's negotiated locale (`locale/bare.ts`).
 * The school tree is the exception: on a main host its paths are no pages, apart
 * from the main host's own School pages, which are bare like every other page
 * when they come without a locale. A school host has no locale in its paths at
 * all. This module reads paths only, so the browser may load it.
 */

/** The segment of the router tree that holds every school page (ADR 0026). */
const SCHOOL_SEGMENT = "school";

/** Decodes one path segment the way the router does, so an encoded segment names the same page. */
const decodeSegment = Option.liftThrowable(decodeURI);

/** The locale that a path names in front, such as `id` of `/id/school`, or none for a path that names none. */
export function pathLocale(pathname: string): Option.Option<Locale> {
  return Option.fromNullishOr(splitLocalePathname(pathname).locale);
}

/** The segments of a path after its locale, each decoded as the router decodes it, or none when one does not decode. */
function pageSegments(pathname: string) {
  return Option.all(
    Arr.map(splitLocalePathname(pathname).publicSegments, decodeSegment)
  );
}

/**
 * Whether the segments after a locale name one of the main host's School pages:
 * the landing, its pricing, the account's School entry, or the page where an
 * account opens its own school (`MAIN_HOST_SCHOOL_PAGES`).
 */
function isSchoolPage(segments: readonly string[]) {
  const [first, ...rest] = segments;
  return (
    first === SCHOOL_SEGMENT &&
    rest.length <= 1 &&
    Arr.contains(MAIN_HOST_SCHOOL_PAGES, Arr.join(rest, "/"))
  );
}

/**
 * Whether a path points into the school tree, with or without a locale in front.
 * Only a school host reaches that tree, so a main host answers such a path with
 * not found. The main host's own School pages are no part of it.
 */
export function isSchoolTreePath(pathname: string): boolean {
  return Option.exists(
    pageSegments(pathname),
    (segments) => segments[0] === SCHOOL_SEGMENT && !isSchoolPage(segments)
  );
}

/**
 * Whether a path is one of the main host's School pages written without a
 * locale, such as `/school/pricing`. The school tree's routes start with
 * `school`, so no route template makes these addresses bare, and this does.
 */
export function isBareSchoolPage(pathname: string): boolean {
  return (
    Option.isNone(pathLocale(pathname)) &&
    Option.exists(pageSegments(pathname), isSchoolPage)
  );
}

/**
 * Narrows a route's locale segment to the public locales. The router passes
 * locale params as plain strings, so the locale route's parse and a loader call
 * this to turn an unknown locale into the router's not-found before they read
 * anything.
 */
export function getLocaleOrThrow(locale: string): Locale {
  const decoded = decodeLocale(locale);
  if (Option.isSome(decoded)) {
    return decoded.value;
  }

  throw notFound();
}
