// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { Array as Arr } from "effect";
import {
  isBareRoutePath,
  isRenderedRoutePath,
  RENDERED_ROUTE_TEMPLATES,
  ROUTE_TEMPLATES,
} from "@/lib/routing/rendered";

/** A stand-in for the router's routes, which name their full path once the router builds the tree. */
const routes = vi.hoisted(() => ({
  "/": { fullPath: "/" },
  "/$locale": { fullPath: "/$locale" },
  "/$locale/$": { fullPath: "/$locale/$" },
  "/$locale/articles/$category/$slug": {
    fullPath: "/$locale/articles/$category/$slug",
  },
  "/$locale/chat/": { fullPath: "/$locale/chat/" },
  "/$locale/chat/$id": { fullPath: "/$locale/chat/$id" },
  "/$locale/quran/$surah": { fullPath: "/$locale/quran/$surah" },
  "/$locale/search": { fullPath: "/$locale/search" },
  "/$locale/user/$username": { fullPath: "/$locale/user/$username" },
  "/$locale/try-out/$country/$exam": {
    fullPath: "/$locale/try-out/$country/$exam",
  },
  "/$locale/try-out/$country/$exam/$track": {
    fullPath: "/$locale/try-out/$country/$exam/$track",
  },
  "/$locale/try-out/$country/$exam/$track/$set/": {
    fullPath: "/$locale/try-out/$country/$exam/$track/$set/",
  },
  "/school/$slug": { fullPath: "/school/$slug" },
  "/school/$slug/exams": { fullPath: "/school/$slug/exams" },
}));

const release = vi.hoisted(() => ({ hasStaticRelease: true }));

vi.mock("cloudflare:workers", () => ({
  /** The assets binding is bound in the test, and absent when the test runs without a static release. */
  env: {
    get ASSETS() {
      return release.hasStaticRelease ? {} : undefined;
    },
  },
}));

vi.mock("@/router", () => ({
  /** Names the routes of the stand-in tree. */
  getRouter: () => ({ routesById: routes }),
}));

describe("rendered route templates", () => {
  it("renders the learner routes and leaves the prerendered pages to the assets", () => {
    expect(RENDERED_ROUTE_TEMPLATES).toContain("/$locale/chat/$id");
    expect(RENDERED_ROUTE_TEMPLATES).toContain("/$locale/search");
    expect(RENDERED_ROUTE_TEMPLATES).not.toContain(
      "/$locale/try-out/$country/$exam/$track/$set/$section"
    );
    expect(RENDERED_ROUTE_TEMPLATES).not.toContain("/$locale/$");
    expect(RENDERED_ROUTE_TEMPLATES).not.toContain("/$locale/quran/$surah");
    expect(RENDERED_ROUTE_TEMPLATES).not.toContain(
      "/$locale/try-out/$country/$exam"
    );
  });

  it("writes each template once, without the trailing slash of an index route", () => {
    expect(ROUTE_TEMPLATES).toContain("/$locale/chat");
    expect(ROUTE_TEMPLATES).not.toContain("/$locale/chat/");
    expect(
      Arr.filter(ROUTE_TEMPLATES, (template) => template === "/$locale/chat")
    ).toHaveLength(1);
  });

  it("renders every route when the build has no static release", () => {
    release.hasStaticRelease = false;

    expect(isRenderedRoutePath(new URL("https://nakafa.com/en/quran/2"))).toBe(
      true
    );
    expect(
      isRenderedRoutePath(new URL("https://nakafa.com/en/wp-login.php"))
    ).toBe(true);
    release.hasStaticRelease = true;
  });

  it("classifies a profile address by the user route that the router rewrites it to", () => {
    expect(isRenderedRoutePath(new URL("https://nakafa.com/en/@nabil"))).toBe(
      true
    );
  });

  it("classifies a locale address by its rendered route", () => {
    expect(isRenderedRoutePath(new URL("https://nakafa.com/en/search"))).toBe(
      true
    );
    expect(isRenderedRoutePath(new URL("https://nakafa.com/en/quran/2"))).toBe(
      false
    );
    expect(
      isRenderedRoutePath(new URL("https://nakafa.com/en/wp-login.php"))
    ).toBe(false);
    expect(
      isRenderedRoutePath(new URL("https://nakafa.com/school/harapan"))
    ).toBe(true);
  });

  it("names a bare address by the path that the router reads", () => {
    expect(isBareRoutePath(new URL("https://nakafa.com/subjects/x"))).toBe(
      true
    );
    expect(isBareRoutePath(new URL("https://nakafa.com/en/subjects/x"))).toBe(
      false
    );
    expect(isBareRoutePath(new URL("https://harapan.nakafa.com/exams"))).toBe(
      false
    );
  });
});
