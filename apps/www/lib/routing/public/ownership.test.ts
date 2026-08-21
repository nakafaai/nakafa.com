// @vitest-environment node

import { describe, expect, it } from "vitest";
import {
  isApplicationRouteRoot,
  isReservedPagePath,
} from "@/lib/routing/public/ownership";

describe("public route ownership", () => {
  it.each([
    ["de", "search"],
    ["en", "articles"],
    ["id", "quran"],
    ["de", "lehrplaene"],
    ["en", "subjects"],
    ["id", "try-out"],
  ] as const)("reserves the %s application root %s", (locale, root) => {
    expect(isApplicationRouteRoot(locale, root)).toBe(true);
  });

  it("keeps signed Page paths outside application ownership", () => {
    expect(isReservedPagePath("de", "impressum")).toBe(false);
    expect(isReservedPagePath("en", "policies/accessibility")).toBe(false);
  });

  it("reserves nested paths under concrete application roots", () => {
    expect(isReservedPagePath("de", "search/advanced")).toBe(true);
    expect(isReservedPagePath("de", "lehrplaene/merdeka")).toBe(true);
  });
});
