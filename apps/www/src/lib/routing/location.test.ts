// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { MATERIAL_CONTEXT_HINT_LENGTH } from "@repo/contents/route/material/context";
import { readRouterPage } from "@/lib/routing/location";

describe("router page", () => {
  it("reads a supported locale from the first path segment", () => {
    expect(
      readRouterPage({ pathname: "/id/materi/matematika", searchStr: "" })
    ).toEqual({ locale: "id", slug: "/materi/matematika" });
  });

  it("falls back to the default locale when the path has no supported locale", () => {
    expect(readRouterPage({ pathname: "/fr/articles", searchStr: "" })).toEqual(
      { locale: "en", slug: "/fr/articles" }
    );
  });

  it("spells the router's canonical segment as the public path of the locale", () => {
    expect(
      readRouterPage({ pathname: "/id/curricula/merdeka", searchStr: "" })
    ).toEqual({ locale: "id", slug: "/kurikulum/merdeka" });
  });

  it("names the root for a locale-only pathname", () => {
    expect(readRouterPage({ pathname: "/en", searchStr: "" })).toEqual({
      locale: "en",
      slug: "/",
    });
  });

  it("reads the material context hint", () => {
    expect(
      readRouterPage({
        pathname: "/en/articles/education",
        searchStr: "?ctx=program.node",
      })
    ).toEqual({
      locale: "en",
      materialContextHint: "program.node",
      slug: "/articles/education",
    });
  });

  it("leaves out a missing material context hint", () => {
    expect(
      readRouterPage({ pathname: "/en/articles", searchStr: "?other=value" })
    ).toEqual({ locale: "en", slug: "/articles" });
  });

  it("reads a hint of the longest length the server takes and leaves out a longer one", () => {
    const longest = "h".repeat(MATERIAL_CONTEXT_HINT_LENGTH);

    expect(
      readRouterPage({ pathname: "/en", searchStr: `?ctx=${longest}` })
    ).toEqual({ locale: "en", materialContextHint: longest, slug: "/" });
    expect(
      readRouterPage({ pathname: "/en", searchStr: `?ctx=${longest}h` })
    ).toEqual({ locale: "en", slug: "/" });
  });
});
