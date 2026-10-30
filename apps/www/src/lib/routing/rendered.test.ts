// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { Array as Arr } from "effect";
import {
  BROWSER_ROUTE_TEMPLATES,
  isBareRoutePath,
  isBrowserRoutePath,
  isRenderedRoutePath,
  RENDERED_ROUTE_TEMPLATES,
  ROUTE_TEMPLATES,
} from "@/lib/routing/rendered";

/** A stand-in for the router's routes, which name their full path once the router builds the tree, and their render options. */
const routes = vi.hoisted(() => ({
  "/": { fullPath: "/", options: {} },
  "/$locale": { fullPath: "/$locale", options: {} },
  "/$locale/$": { fullPath: "/$locale/$", options: {} },
  "/$locale/articles/$category/$slug": {
    fullPath: "/$locale/articles/$category/$slug",
    options: {},
  },
  "/$locale/chat/": { fullPath: "/$locale/chat/", options: {} },
  "/$locale/chat/$id": { fullPath: "/$locale/chat/$id", options: {} },
  "/$locale/quran/$surah": { fullPath: "/$locale/quran/$surah", options: {} },
  "/$locale/search": { fullPath: "/$locale/search", options: {} },
  "/$locale/user/$username": {
    fullPath: "/$locale/user/$username",
    options: {},
  },
  "/$locale/try-out/$country/$exam": {
    fullPath: "/$locale/try-out/$country/$exam",
    options: {},
  },
  "/$locale/try-out/$country/$exam/$track": {
    fullPath: "/$locale/try-out/$country/$exam/$track",
    options: {},
  },
  "/$locale/try-out/$country/$exam/$track/$set/": {
    fullPath: "/$locale/try-out/$country/$exam/$track/$set/",
    options: {},
  },
  "/$locale/_main/_app/_account": {
    fullPath: "/$locale",
    options: { ssr: false },
  },
  "/$locale/_main/_app/_account/home": {
    fullPath: "/$locale/home",
    options: {},
  },
  "/$locale/_main/_app/_account/user/settings/": {
    fullPath: "/$locale/user/settings/",
    options: {},
  },
  "/school": { fullPath: "/school", options: { ssr: false } },
  "/school/$slug": { fullPath: "/school/$slug", options: {} },
  "/school/$slug/exams": { fullPath: "/school/$slug/exams", options: {} },
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

describe("browser route templates", () => {
  it("names the pages inside a main-site route that renders only in the browser", () => {
    expect(BROWSER_ROUTE_TEMPLATES).toStrictEqual([
      "/$locale/home",
      "/$locale/user/settings",
    ]);
  });

  it("matches a locale address of those pages and nothing else", () => {
    for (const [address, browser] of [
      ["https://nakafa.com/en/home", true],
      ["https://nakafa.com/id/user/settings/", true],
      ["https://nakafa.com/xx/home", false],
      ["https://nakafa.com/en", false],
      ["https://nakafa.com/en/search", false],
      ["https://harapan.nakafa.com/exams", false],
    ] as const) {
      expect(isBrowserRoutePath(new URL(address))).toBe(browser);
    }
  });
});
