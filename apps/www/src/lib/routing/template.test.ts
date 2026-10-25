import { describe, expect, it } from "@effect/vitest";
import { isRenderedPath, matchesRouteTemplate } from "@/lib/routing/template";

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

describe("rendered paths", () => {
  const rendered = ["/$locale/chat/$id", "/$locale/search"];

  it("renders the paths of the router's own routes and of a bare profile", () => {
    expect(isRenderedPath("/", rendered)).toBe(true);
    expect(isRenderedPath("/_serverFn/abc", rendered)).toBe(true);
    expect(isRenderedPath("/@nabil", rendered)).toBe(true);
  });

  it("renders a locale path only when a rendered template names it", () => {
    expect(isRenderedPath("/en/search", rendered)).toBe(true);
    expect(isRenderedPath("/id/chat/abc", rendered)).toBe(true);
    expect(isRenderedPath("/en/wp-login.php", rendered)).toBe(false);
    expect(isRenderedPath("/en/articles/gone.md", rendered)).toBe(false);
  });
});
