import { describe, expect, it } from "vitest";
import { getPublicContentRouteCheck } from "./public-route";

describe("public content route checks", () => {
  it("classifies article routes and invalid article listings", () => {
    expect(getPublicContentRouteCheck("articles")).toEqual({ mode: "app" });
    expect(getPublicContentRouteCheck("articles/politics")).toEqual({
      mode: "article-category",
      parentRoute: "articles/politics",
    });
    expect(
      getPublicContentRouteCheck("articles/politics/dynastic-politics")
    ).toEqual({
      mode: "exact",
      route: "articles/politics/dynastic-politics",
    });
    expect(getPublicContentRouteCheck("articles/politics-missing")).toEqual({
      mode: "missing",
    });
  });

  it("leaves routes owned by other projections outside this classifier", () => {
    expect(getPublicContentRouteCheck("curriculum/merdeka")).toEqual({
      mode: "outside",
    });
  });

  it("classifies Quran and non-content routes", () => {
    expect(getPublicContentRouteCheck("quran")).toEqual({ mode: "app" });
    expect(getPublicContentRouteCheck("quran/1")).toEqual({
      mode: "exact",
      route: "quran/1",
    });
    expect(getPublicContentRouteCheck("search")).toEqual({ mode: "outside" });
  });
});
