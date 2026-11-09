// @vitest-environment node

import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { isReservedUsername } from "@repo/backend/confect/users/reserved";
import { readUsername } from "@repo/backend/confect/users/username";
import { APPLICATION_ROUTE_ROOTS } from "@repo/contents/route/root";
import { PUBLIC_ROUTE_SURFACES } from "@repo/contents/route/surface";
import { SITE_ORIGIN } from "@repo/seo/origin";
import {
  Array as Arr,
  Effect,
  FileSystem,
  HashSet,
  Path,
  Result,
  String as Str,
} from "effect";
import {
  isApplicationRoutePath,
  isApplicationRouteRoot,
  isReservedPagePath,
} from "@/lib/ownership/route";
import { routeRewrite } from "@/lib/routing/rewrite";

/** One full route path of the generated tree, below the locale, as its route index lists it. */
const FULL_PATH_PATTERN = /(?<=^ {2}')\/\$locale\/[^']*(?=': typeof)/gmu;
/** The locale that every sample address is written in, which the public path leaves out. */
const LOCALE_PREFIX_PATTERN = /^\/en\/?/u;

/**
 * The public address of one route path: each parameter takes a sample value
 * that a username, an id, a hash and a slug all accept, and the router's output
 * rewrite writes it as the browser shows it.
 */
function addressOf(template: string) {
  const sample = Arr.join(
    Arr.map(Arr.filter(Str.split(template, "/"), Str.isNonEmpty), (segment) => {
      if (segment === "$locale") {
        return "en";
      }
      return Str.startsWith("$")(segment) ? "nabil" : segment;
    }),
    "/"
  );
  const { pathname } = routeRewrite.output({
    url: new URL(sample, SITE_ORIGIN),
  });
  return Str.replace(LOCALE_PREFIX_PATTERN, "")(pathname);
}

/** The extension of a route file, which names no segment. */
const ROUTE_FILE_EXTENSION = /\.tsx$/u;

/**
 * The first path segment of a route file below the locale, as the router names it: pathless layouts (`_main`),
 * index and layout files leave no segment, and a flat file name such as `verify.$hash` names its segments with dots.
 */
function routeRootOf(file: string) {
  return Arr.head(
    Arr.filter(
      Arr.flatMap(
        Str.split(Str.replace(ROUTE_FILE_EXTENSION, "")(file), "/"),
        Str.split(".")
      ),
      (segment) =>
        !(
          Str.startsWith("_")(segment) ||
          segment === "index" ||
          segment === "route"
        )
    )
  );
}

describe("public route ownership", () => {
  it.effect(
    "owns the first segment of every route below the locale, so no route answers as a missing page",
    () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const files = yield* fs.readDirectory(
          path.resolve("src/routes/$locale"),
          {
            recursive: true,
          }
        );
        const owned = HashSet.union(
          APPLICATION_ROUTE_ROOTS,
          HashSet.fromIterable(
            Arr.map(PUBLIC_ROUTE_SURFACES, (surface) => surface.appSegment)
          )
        );
        const roots = Arr.dedupe(
          Arr.getSomes(
            Arr.map(
              Arr.filter(files, (file) => Str.endsWith(".tsx")(file)),
              routeRootOf
            )
          )
        );
        // A route parameter at the root, such as the authored pages' splat, owns no segment of its own.
        const named = Arr.filter(roots, (root) => !Str.startsWith("$")(root));
        expect(named).toEqual(expect.arrayContaining(["verify", "pricing"]));
        expect(
          Arr.filter(named, (root) => !HashSet.has(owned, root)),
          "declare the root in @repo/contents/route/root"
        ).toEqual([]);
      }).pipe(Effect.provide(NodeServices.layer))
  );

  it.effect(
    "accepts a page of every route that the router serves below the locale, so no route answers a hard 404",
    () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const tree = yield* fs.readFileString(
          path.resolve("src/routeTree.gen.ts")
        );
        // A route id names its pathless layouts (`/_main`), which no address shows.
        const templates = Arr.filter(
          Arr.dedupe(
            Arr.map(
              Arr.fromIterable(Str.matchAll(FULL_PATH_PATTERN)(tree)),
              (match) => match[0]
            )
          ),
          (template) => !Str.includes("/_")(template)
        );
        const addresses = Arr.map(templates, addressOf);
        // The locale's index, and the root splat that serves a signed Page, name no application root.
        const served = Arr.filter(
          addresses,
          (address) => !(address === "" || address === "nabil")
        );
        expect(served).toEqual(
          expect.arrayContaining(["agent", "island/nabil", "@nabil/chat"])
        );
        expect(
          Arr.filter(
            served,
            (address) => !isApplicationRoutePath("en", address)
          ),
          "give the route's root a rule in ROOT_RULES"
        ).toEqual([]);
      }).pipe(Effect.provide(NodeServices.layer))
  );

  it("reserves the username of every declared application route root", () => {
    const roots = Arr.fromIterable(APPLICATION_ROUTE_ROOTS);
    const names = Arr.filter(roots, (root) =>
      Result.isSuccess(readUsername(root))
    );

    // An empty declaration would reserve nothing.
    expect(names).toEqual(expect.arrayContaining(["articles", "chat", "user"]));
    expect(
      Arr.filter(names, (name) => !isReservedUsername(name)),
      "reserve a new route root in @repo/contents/route/root"
    ).toEqual([]);
  });

  it.each([
    ["de", "search"],
    ["en", "articles"],
    ["id", "quran"],
    ["en", "pricing"],
    ["de", "lehrplaene"],
    ["en", "subjects"],
    ["id", "try-out"],
    ["id", "@nabilfatih"],
    ["de", "@Nabil_Fatih"],
  ] as const)("reserves the %s application root %s", (locale, root) => {
    expect(isApplicationRouteRoot(locale, root)).toBe(true);
  });

  it.each(["@", "@ab", "@1abc", "@nabil.md", "@nabil%20fatih", "nabilfatih"])(
    "leaves the root %s outside application ownership",
    (root) => {
      expect(isApplicationRouteRoot("id", root)).toBe(false);
    }
  );

  it("keeps signed Page paths outside application ownership", () => {
    expect(isReservedPagePath("de", "impressum")).toBe(false);
    expect(isReservedPagePath("en", "policies/accessibility")).toBe(false);
    expect(isReservedPagePath("en", "")).toBe(false);
  });

  it("reserves nested paths under concrete application roots", () => {
    expect(isReservedPagePath("de", "search/advanced")).toBe(true);
    expect(isReservedPagePath("de", "lehrplaene/merdeka")).toBe(true);
  });

  it.each([
    ["de", "search"],
    ["de", "pricing"],
    ["de", "notifications"],
    ["de", "auth"],
    ["de", "auth/error"],
    ["de", "onboarding"],
    ["de", "operators"],
    ["de", "school"],
    ["de", "school/enter"],
    ["de", "school/new"],
    ["de", "school/pricing"],
    ["de", "chat/new"],
    ["de", "comment/fabricated"],
    ["en", "island"],
    ["en", "island/nabil"],
    ["de", "user/settings/learning"],
    ["de", "user/settings/subscriptions"],
    ["de", "user/settings/memory"],
    ["de", "@nabil"],
    ["de", "@Nabil_Fatih"],
    ["de", "@nabil/chat"],
    ["de", "@nabil/comments"],
    ["de", "og/social/card"],
    ["de", "lehrplaene/merdeka/klasse-10"],
    ["de", "faecher/mathematik/geometrie"],
    ["en", `verify/${"a".repeat(64)}`],
    [
      "de",
      "try-out/deutschland/aufnahmepruefung/studienkolleg-der-tu-darmstadt/mathematik/aufgabensatz-1/abschnitt-1",
    ],
  ] as const)("accepts the %s application path %s", (locale, publicPath) => {
    expect(isApplicationRoutePath(locale, publicPath)).toBe(true);
  });

  it.each([
    ["de", "search/fabricated"],
    ["de", "pricing/fabricated"],
    ["en", "verify"],
    ["en", "verify/code/fabricated"],
    ["de", "notifications/fabricated"],
    ["de", ""],
    ["de", "fabricated"],
    ["de", "auth/continue"],
    ["de", "auth/fabricated"],
    ["de", "auth/error/fabricated"],
    ["de", "chat/id/fabricated"],
    ["de", "comment"],
    ["de", "comment/id/fabricated"],
    ["en", "island/nabil/fabricated"],
    ["de", "onboarding/focus"],
    ["de", "onboarding/role"],
    ["de", "onboarding/fabricated"],
    ["de", "operators/fabricated"],
    ["de", "school/harapan"],
    ["de", "school/new/fabricated"],
    ["de", "school/pricing/fabricated"],
    ["de", "user"],
    ["de", "user/nabil"],
    ["de", "user/nabil/chat"],
    ["de", "user/settings/fabricated"],
    ["de", "user/settings/memory/fabricated"],
    ["de", "@nabil/fabricated"],
    ["de", "@nabil/chat/fabricated"],
    ["de", "@nabil/comments/fabricated"],
    ["de", "@ab"],
    ["de", "@nabil.md"],
    ["de", "@"],
    ["de", "og"],
    ["de", "faecher"],
    ["en", "subjects/mathematics"],
    ["de", "try-out/a/b/c/d/e/f/g"],
  ] as const)("rejects the %s application path %s", (locale, publicPath) => {
    expect(isApplicationRoutePath(locale, publicPath)).toBe(false);
  });
});
