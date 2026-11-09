import type { AppLocaleCode } from "@nakafa/aksara-contracts/locale";
import { APPLICATION_ROUTE_ROOTS } from "@repo/contents/route/root";
import {
  PUBLIC_ROUTE_SURFACES,
  type PublicRouteAppSegment,
} from "@repo/contents/route/surface";
import { Array as Arr, HashSet, Option, Record as Rec } from "effect";
import { isProfileTab, readProfileRoot } from "@/lib/profile/route";
import { userSettingsSections } from "@/lib/settings/routes";
import type { FileRouteTypes } from "@/routeTree.gen";

/** A declared locale, since every declared locale owns its route slugs before Nakafa serves it. */
type PublicLocale = AppLocaleCode;

/** The deepest try-out page below its namespace: its country, exam, group, track, set and section. */
const TRYOUT_PAGE_SEGMENTS = 6;

function readPublicSurface(locale: PublicLocale, root: string) {
  return Arr.findFirst(
    PUBLIC_ROUTE_SURFACES,
    (surface) => surface.routeSlugs[locale] === root
  );
}

function isPublicSurfacePath(
  surface: (typeof PUBLIC_ROUTE_SURFACES)[number],
  segments: readonly string[]
) {
  if (surface.key === "curriculum") {
    return true;
  }

  if (surface.key === "subject") {
    return segments.length >= 2;
  }

  return segments.length <= TRYOUT_PAGE_SEGMENTS;
}

/** Whether the segments below a root name the root's own page and nothing below it. */
function isRootPage(segments: readonly string[]) {
  return segments.length === 0;
}

function isUserPath(segments: readonly string[]) {
  // The settings table owns which pages exist below `user`. A profile has no
  // address here: it lives at `@username`, which the profile root serves.
  return (
    segments[0] === "settings" &&
    Arr.some(
      userSettingsSections,
      ({ target }) => target.to === `/$locale/user/${Arr.join(segments, "/")}`
    )
  );
}

/** Checks whether one root belongs to a concrete application route. */
export function isApplicationRouteRoot(locale: PublicLocale, root: string) {
  if (
    HashSet.has(APPLICATION_ROUTE_ROOTS, root) ||
    Option.isSome(readProfileRoot(root))
  ) {
    return true;
  }

  return Option.isSome(readPublicSurface(locale, root));
}

/**
 * The pages under `school` that a main host serves: the public landing, the
 * account's School entry, the page where an account opens its own school, and
 * the pricing. No school can take these addresses.
 */
export const MAIN_HOST_SCHOOL_PAGES = ["", "enter", "new", "pricing"];

/** The first segment of one route path below the locale, which names the route's root. */
type RootOf<Path> = Path extends `/$locale/${infer Rest}`
  ? Rest extends `${infer Root}/${string}`
    ? Root
    : Rest
  : never;

/**
 * Every root that a route of the generated tree serves below the locale, except
 * the index, the signed Page that the splat serves, and the public surfaces,
 * whose localized namespaces `readPublicSurface` owns.
 */
type ApplicationRoot = Exclude<
  RootOf<FileRouteTypes["fullPaths"]>,
  "" | `$${string}` | PublicRouteAppSegment
>;

/** Whether the segments below one root name a page that its routes serve. */
type RootRule = (segments: readonly string[]) => boolean;

/**
 * The rule of every root the route tree serves. Its keys come from the
 * generated route tree, so a route root without a rule here, or a rule for a
 * root that no route serves, fails the typecheck instead of answering a hard
 * 404 at the new page.
 */
const ROOT_RULES: { readonly [Root in ApplicationRoot]: RootRule } = {
  // The page where a signed-in person answers an agent's authorization.
  agent: isRootPage,
  // The article index, one category, and one article; the published inventory decides which exist.
  articles: (segments) => segments.length <= 2,
  auth: (segments) => Arr.contains(["", "error"], Arr.join(segments, "/")),
  chat: (segments) => segments.length <= 1,
  comment: (segments) => segments.length === 1,
  contributor: isRootPage,
  home: isRootPage,
  // The owner's island, and a visit to one learner's shared island by username.
  island: (segments) => segments.length <= 1,
  notifications: isRootPage,
  onboarding: isRootPage,
  operators: isRootPage,
  pricing: isRootPage,
  // The Quran index and one surah.
  quran: (segments) => segments.length <= 1,
  // The main host serves the public School landing and its pricing, the
  // account's School entry, and the page where an account opens its own school;
  // every other school page lives on the school's own host.
  school: (segments) =>
    Arr.contains(MAIN_HOST_SCHOOL_PAGES, Arr.join(segments, "/")),
  search: isRootPage,
  user: isUserPath,
  // The public check of a report card's QR code names one hash below `verify`.
  verify: (segments) => segments.length === 1,
};

/**
 * Checks whether the route tree can receive one public path.
 *
 * Signed projection namespaces accept descendant shapes here because their
 * owning route validates the exact published inventory. Fixed application
 * routes are matched exactly so impossible descendants can return a hard 404
 * before the app starts streaming.
 */
export function isApplicationRoutePath(
  locale: PublicLocale,
  publicPath: string
) {
  const [root, ...segments] = publicPath.split("/");
  if (!root) {
    return false;
  }

  const publicSurface = readPublicSurface(locale, root);
  if (Option.isSome(publicSurface)) {
    return isPublicSurfacePath(publicSurface.value, segments);
  }

  if (Option.isSome(readProfileRoot(root))) {
    return isProfileTab(segments);
  }

  // The social images that the build writes below each locale, which no route renders.
  if (root === "og") {
    return segments.length >= 1;
  }

  return Option.match(
    Arr.findFirst(Rec.toEntries(ROOT_RULES), ([name]) => name === root),
    { onNone: () => false, onSome: ([, rule]) => rule(segments) }
  );
}

/** Checks whether one signed Page path would be shadowed by the application. */
export function isReservedPagePath(locale: PublicLocale, publicPath: string) {
  const [root] = publicPath.split("/");
  if (!root) {
    return false;
  }

  return isApplicationRouteRoot(locale, root);
}
