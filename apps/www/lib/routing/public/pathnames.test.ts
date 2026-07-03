import { describe, expect, it } from "vitest";
import {
  getLocalizedMappedRoutePathname,
  projectLocalizedMappedRoutePathname,
} from "@/lib/routing/public/pathnames";

describe("public route pathnames", () => {
  it("resolves internal route keys to localized public pathnames", () => {
    expect(
      getLocalizedMappedRoutePathname({
        locale: "en",
        route: "/curricula",
      })
    ).toBe("/curriculum");
    expect(
      getLocalizedMappedRoutePathname({
        locale: "id",
        route: "/missing",
      })
    ).toBeNull();
  });

  it("projects mapped public pathnames across locales", () => {
    expect(
      projectLocalizedMappedRoutePathname({
        currentLocale: "id",
        publicPath: "/kurikulum",
        targetLocale: "en",
      })
    ).toBe("/curriculum");
    expect(
      projectLocalizedMappedRoutePathname({
        currentLocale: "id",
        publicPath: "kurikulum",
        targetLocale: "en",
      })
    ).toBe("/curriculum");
    expect(
      projectLocalizedMappedRoutePathname({
        currentLocale: "id",
        publicPath: "tidak-ada",
        targetLocale: "en",
      })
    ).toBeNull();
  });
});
