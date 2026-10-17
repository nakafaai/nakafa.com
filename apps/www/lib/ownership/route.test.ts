// @vitest-environment node

import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { isReservedUsername } from "@repo/backend/confect/users/reserved";
import { readUsername } from "@repo/backend/confect/users/username";
import { Array as Arr, Effect, FileSystem, Path, Result } from "effect";
import {
  isApplicationRoutePath,
  isApplicationRouteRoot,
  isReservedPagePath,
} from "@/lib/ownership/route";

const ROUTE_FILE = /^(?:page|route)\.tsx?$/;
/** A folder that is no part of an address: a route group, a slot, a parameter, a private folder, or the folder itself. */
const NOT_ADDRESSED = /^[(@[_.]/;

/**
 * Reads the first segment of every route in the route tree. A route is a folder
 * with a page or a route handler, and its first segment is the first folder that
 * is part of an address, so a catch-all page below groups has none.
 */
const readTreeRoots = Effect.fn("test.readTreeRoots")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const entries = yield* fs.readDirectory(path.join(process.cwd(), "app"), {
    recursive: true,
  });
  return Arr.dedupe(
    Arr.getSomes(
      Arr.map(
        Arr.filter(entries, (entry) => ROUTE_FILE.test(path.basename(entry))),
        (entry) =>
          Arr.findFirst(
            path.dirname(entry).split(path.sep),
            (segment) => !NOT_ADDRESSED.test(segment)
          )
      )
    )
  );
});

describe("public route ownership", () => {
  it.effect("reserves the username of every root in the route tree", () =>
    Effect.gen(function* () {
      const roots = yield* readTreeRoots();
      const names = Arr.filter(roots, (root) =>
        Result.isSuccess(readUsername(root))
      );

      // A scan that found nothing would reserve nothing.
      expect(names).toEqual(
        expect.arrayContaining([
          "api",
          "articles",
          "chat",
          "quran",
          "sitemap",
          "user",
        ])
      );
      expect(
        Arr.filter(names, (name) => !isReservedUsername(name)),
        "reserve a new route root in @repo/contents/route/root"
      ).toEqual([]);
    }).pipe(Effect.provide(NodeServices.layer))
  );

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
    ["de", "auth"],
    ["de", "auth/error"],
    ["de", "onboarding"],
    ["de", "chat/new"],
    ["de", "user/settings/learning"],
    ["de", "user/settings/subscriptions"],
    ["de", "user/settings/memory"],
    ["de", "@nabil"],
    ["de", "@Nabil_Fatih"],
    ["de", "@nabil/chat"],
    ["de", "og/social/card"],
    ["de", "lehrplaene/merdeka/klasse-10"],
    ["de", "faecher/mathematik/geometrie"],
    ["de", "try-out/deutschland/abitur/mathematik/set-1/section-1"],
  ] as const)("accepts the %s application path %s", (locale, publicPath) => {
    expect(isApplicationRoutePath(locale, publicPath)).toBe(true);
  });

  it.each([
    ["de", "search/fabricated"],
    ["de", "pricing/fabricated"],
    ["de", ""],
    ["de", "fabricated"],
    ["de", "auth/continue"],
    ["de", "auth/fabricated"],
    ["de", "auth/error/fabricated"],
    ["de", "chat/id/fabricated"],
    ["de", "onboarding/focus"],
    ["de", "onboarding/role"],
    ["de", "onboarding/fabricated"],
    ["de", "user"],
    ["de", "user/nabil"],
    ["de", "user/nabil/chat"],
    ["de", "user/settings/fabricated"],
    ["de", "user/settings/memory/fabricated"],
    ["de", "@nabil/fabricated"],
    ["de", "@nabil/chat/fabricated"],
    ["de", "@ab"],
    ["de", "@nabil.md"],
    ["de", "@"],
    ["de", "og"],
    ["de", "faecher"],
    ["en", "subjects/mathematics"],
    ["de", "try-out/a/b/c/d/e/f"],
  ] as const)("rejects the %s application path %s", (locale, publicPath) => {
    expect(isApplicationRoutePath(locale, publicPath)).toBe(false);
  });
});
