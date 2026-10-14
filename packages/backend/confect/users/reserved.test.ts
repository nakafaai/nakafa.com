import { describe, expect, it } from "@effect/vitest";
import { isReservedUsername } from "@repo/backend/confect/users/reserved";
import { APPLICATION_ROUTE_ROOTS } from "@repo/contents/route/root";
import { PUBLIC_ROUTE_SURFACES } from "@repo/contents/route/surface";
import { Array as Arr, Record as Rec } from "effect";

describe("users/reserved", () => {
  it.each([
    "nakafa",
    "nina",
    "admin",
    "support",
    "help",
    "official",
    "school",
    "sekolah",
    "settings",
    "api",
  ])("reserves the name %s that could pass for Nakafa", (name) => {
    expect(isReservedUsername(name)).toBe(true);
  });

  it.each(["about", "community", "discord", "sitemap"])(
    "reserves the root %s that answers outside the application route roots",
    (name) => {
      expect(isReservedUsername(name)).toBe(true);
    }
  );

  it("reserves every root of an application route", () => {
    const roots = Arr.fromIterable(APPLICATION_ROUTE_ROOTS);
    expect(roots).toContain("pricing");
    for (const root of roots) {
      expect(isReservedUsername(root)).toBe(true);
    }
  });

  it("reserves the namespace of every public route surface in every language", () => {
    const namespaces = Arr.flatMap(PUBLIC_ROUTE_SURFACES, (surface) => [
      surface.appSegment,
      surface.key,
      ...Rec.values(surface.routeSlugs),
    ]);
    expect(namespaces).toContain("kurikulum");
    expect(namespaces).toContain("lehrplaene");
    expect(namespaces).toContain("subjects");
    for (const namespace of namespaces) {
      expect(isReservedUsername(namespace)).toBe(true);
    }
  });

  it.each(["nabilfatih", "nakafa2", "teman", "jo2", "learner_1"])(
    "leaves the name %s to an account",
    (name) => {
      expect(isReservedUsername(name)).toBe(false);
    }
  );
});
