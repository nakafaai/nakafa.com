import { APPLICATION_ROUTE_ROOTS } from "@repo/contents/route/root";
import { PUBLIC_ROUTE_SURFACES } from "@repo/contents/route/surface";
import { Array as Arr, HashSet, Record as Rec } from "effect";

/**
 * Names that could pass for Nakafa itself, its people, or its help. A username
 * and a school login name both refuse them, so the list has one owner.
 */
const MISLEADING_NAMES = [
  "nakafa",
  "nina",
  "admin",
  "administrator",
  "support",
  "help",
  "official",
  "operator",
  "root",
  "system",
  "login",
  "dev",
  "test",
  "school",
  "sekolah",
  "settings",
  "api",
];
const MISLEADING_NAME_SET = HashSet.fromIterable(MISLEADING_NAMES);

/**
 * Roots that answer without being an application route root: the sitemaps,
 * which live outside the locale tree, and the retired pages that
 * `next.config.ts` redirects to the home page or to the community.
 */
const OUTSIDE_ROUTE_ROOTS = ["about", "community", "discord", "sitemap"];

/**
 * Every name that no account takes: the misleading ones, each root of an
 * application route, each namespace a public route surface owns in any
 * language, and the roots that answer outside the route roots.
 */
export const RESERVED_USERNAMES = HashSet.fromIterable<string>(
  Arr.flatten([
    MISLEADING_NAMES,
    OUTSIDE_ROUTE_ROOTS,
    Arr.fromIterable(APPLICATION_ROUTE_ROOTS),
    Arr.flatMap(PUBLIC_ROUTE_SURFACES, (surface) => [
      surface.appSegment,
      surface.key,
      ...Rec.values(surface.routeSlugs),
    ]),
  ])
);

/** Whether a username is a route or could pass for Nakafa, so no account takes it. */
export function isReservedUsername(username: string) {
  return HashSet.has(RESERVED_USERNAMES, username);
}

/**
 * Whether a name could pass for Nakafa, its people, or its help. A school login
 * name is never a URL, so it refuses these names and not the routes.
 */
export function isMisleadingName(name: string) {
  return HashSet.has(MISLEADING_NAME_SET, name);
}
