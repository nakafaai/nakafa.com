// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { Array as Arr } from "effect";
import {
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
  "/$locale/try-out/$country/$exam": {
    fullPath: "/$locale/try-out/$country/$exam",
  },
  "/$locale/try-out/$country/$exam/$track": {
    fullPath: "/$locale/try-out/$country/$exam/$track",
  },
  "/$locale/try-out/$country/$exam/$track/$set/": {
    fullPath: "/$locale/try-out/$country/$exam/$track/$set/",
  },
}));

const release = vi.hoisted(() => ({ hasStaticRelease: true }));

vi.mock("@/lib/routing/release", () => ({
  /** Reads the flag of the test, so one test can run without the static release. */
  get HAS_STATIC_RELEASE() {
    return release.hasStaticRelease;
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
    expect(RENDERED_ROUTE_TEMPLATES).toContain(
      "/$locale/try-out/$country/$exam/$track"
    );
    expect(RENDERED_ROUTE_TEMPLATES).toContain(
      "/$locale/try-out/$country/$exam/$track/$set"
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

    expect(isRenderedRoutePath("/en/quran/2")).toBe(true);
    expect(isRenderedRoutePath("/en/wp-login.php")).toBe(true);
    release.hasStaticRelease = true;
  });

  it("classifies a locale address by its rendered route", () => {
    expect(isRenderedRoutePath("/en/search")).toBe(true);
    expect(isRenderedRoutePath("/en/quran/2")).toBe(false);
    expect(isRenderedRoutePath("/en/wp-login.php")).toBe(false);
    expect(isRenderedRoutePath("/school/harapan")).toBe(true);
  });
});
