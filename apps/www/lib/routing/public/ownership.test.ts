// @vitest-environment node

import { describe, expect, it } from "vitest";
import {
  isApplicationRoutePath,
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
    expect(isReservedPagePath("en", "")).toBe(false);
  });

  it("reserves nested paths under concrete application roots", () => {
    expect(isReservedPagePath("de", "search/advanced")).toBe(true);
    expect(isReservedPagePath("de", "lehrplaene/merdeka")).toBe(true);
  });

  it.each([
    ["de", "search"],
    ["de", "onboarding"],
    ["de", "chat/new"],
    ["de", "onboarding/focus"],
    ["de", "user/settings/subscriptions"],
    ["de", "user/nabil/chat"],
    ["de", "school"],
    ["de", "school/onboarding/create"],
    ["de", "school/nakafa"],
    ["de", "school/nakafa/home"],
    ["de", "school/nakafa/notifications"],
    ["de", "school/nakafa/classes"],
    ["de", "school/nakafa/classes/class-id"],
    ["de", "school/nakafa/classes/class-id/materials"],
    ["de", "school/nakafa/classes/class-id/people"],
    ["de", "school/nakafa/classes/class-id/forum"],
    ["de", "school/nakafa/classes/class-id/forum/thread-id"],
    ["de", "og/social/card"],
    ["de", "lehrplaene/merdeka/klasse-10"],
    ["de", "faecher/mathematik/geometrie"],
    ["de", "try-out/deutschland/abitur/mathematik/set-1/section-1"],
  ] as const)("accepts the %s application path %s", (locale, publicPath) => {
    expect(isApplicationRoutePath(locale, publicPath)).toBe(true);
  });

  it.each([
    ["de", "search/fabricated"],
    ["de", ""],
    ["de", "fabricated"],
    ["de", "auth/fabricated"],
    ["de", "chat/id/fabricated"],
    ["de", "onboarding/fabricated"],
    ["de", "user"],
    ["de", "user/settings/fabricated"],
    ["de", "school/select/fabricated"],
    ["de", "school/onboarding/fabricated"],
    ["de", "school/nakafa/home/fabricated"],
    ["de", "school/nakafa/fabricated"],
    ["de", "school/nakafa/classes/class-id/assessments"],
    ["de", "school/nakafa/classes/class-id/fabricated"],
    ["de", "school/nakafa/classes/class-id/materials/fabricated"],
    ["de", "og"],
    ["de", "faecher"],
    ["en", "subjects/mathematics"],
    ["de", "try-out/a/b/c/d/e/f"],
  ] as const)("rejects the %s application path %s", (locale, publicPath) => {
    expect(isApplicationRoutePath(locale, publicPath)).toBe(false);
  });
});
