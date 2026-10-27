import { describe, expect, it } from "@effect/vitest";
import {
  isBarePath,
  isRenderedPath,
  matchesRouteTemplate,
  namesFile,
} from "@/lib/routing/template";

describe("route templates", () => {
  it("matches static segments, parameters and a trailing slash", () => {
    expect(matchesRouteTemplate("/$locale/chat", "/en/chat")).toBe(true);
    expect(matchesRouteTemplate("/$locale/chat/", "/en/chat/")).toBe(true);
    expect(matchesRouteTemplate("/$locale/chat/$id", "/en/chat/abc")).toBe(
      true
    );
    expect(matchesRouteTemplate("/$locale/chat", "/en/chats")).toBe(false);
    expect(matchesRouteTemplate("/$locale/chat/$id", "/en/chat")).toBe(false);
    expect(matchesRouteTemplate("/$locale/chat", "/en/chat/abc")).toBe(false);
  });

  it("takes the rest of the path with a splat", () => {
    expect(matchesRouteTemplate("/$locale/$", "/en")).toBe(true);
    expect(matchesRouteTemplate("/$locale/$", "/en/subjects/a/b/c")).toBe(true);
    expect(
      matchesRouteTemplate("/$locale/materials/$subject/$topic/$", "/en/x/y")
    ).toBe(false);
  });
});

describe("file addresses", () => {
  it("names a file by the extension of its last segment, and a page by none", () => {
    expect(namesFile("/assets/old.js")).toBe(true);
    expect(namesFile("/en/try-out/indonesia/snbt/2027.md")).toBe(true);
    expect(namesFile("/en/try-out/indonesia/snbt/2027")).toBe(false);
    expect(namesFile("/v1.2/en/page")).toBe(false);
  });
});

describe("bare paths", () => {
  const templates = ["/", "/$locale/search", "/api/weather", "/school/$slug"];

  it("names a path outside the root, the locales and the Worker's own routes", () => {
    expect(isBarePath("/subjects/physics", templates)).toBe(true);
    expect(isBarePath("/@nabil", templates)).toBe(true);
    expect(isBarePath("/wp-login.php", templates)).toBe(true);
  });

  it("leaves the root, a locale path, a server function and a Worker route", () => {
    expect(isBarePath("/", templates)).toBe(false);
    expect(isBarePath("/en/anything", templates)).toBe(false);
    expect(isBarePath("/_serverFn/abc", templates)).toBe(false);
    expect(isBarePath("/api/other", templates)).toBe(false);
    expect(isBarePath("/school/harapan/exams", templates)).toBe(false);
  });
});

describe("rendered paths", () => {
  const rendered = ["/$locale/chat/$id", "/$locale/search", "/school/$slug"];

  it("renders the root and the paths of the router's own routes", () => {
    expect(isRenderedPath("/", rendered)).toBe(true);
    expect(isRenderedPath("/_serverFn/abc", rendered)).toBe(true);
    expect(isRenderedPath("/school/harapan/exams", rendered)).toBe(true);
  });

  it("leaves a bare path to the static not-found page", () => {
    expect(isRenderedPath("/@nabil", rendered)).toBe(false);
    expect(isRenderedPath("/.env", rendered)).toBe(false);
  });

  it("renders a locale path only when a rendered template names it", () => {
    expect(isRenderedPath("/en/search", rendered)).toBe(true);
    expect(isRenderedPath("/id/chat/abc", rendered)).toBe(true);
    expect(isRenderedPath("/en/wp-login.php", rendered)).toBe(false);
    expect(isRenderedPath("/en/articles/gone.md", rendered)).toBe(false);
  });
});
