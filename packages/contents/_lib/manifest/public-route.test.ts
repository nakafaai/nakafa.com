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

  it("does not classify route-projection owned material or curriculum routes", () => {
    expect(getPublicContentRouteCheck("subject")).toEqual({ mode: "outside" });
    expect(getPublicContentRouteCheck("subjects/mathematics")).toEqual({
      mode: "outside",
    });
    expect(getPublicContentRouteCheck("materi/matematika")).toEqual({
      mode: "outside",
    });
    expect(getPublicContentRouteCheck("curriculum")).toEqual({
      mode: "outside",
    });
    expect(getPublicContentRouteCheck("kurikulum/merdeka")).toEqual({
      mode: "outside",
    });
    expect(getPublicContentRouteCheck("material")).toEqual({
      mode: "outside",
    });
    expect(getPublicContentRouteCheck("material/lesson/mathematics")).toEqual({
      mode: "outside",
    });
  });

  it("does not classify route-projection owned assessment routes", () => {
    expect(getPublicContentRouteCheck("exercises")).toEqual({
      mode: "outside",
    });
    expect(getPublicContentRouteCheck("assessment")).toEqual({
      mode: "outside",
    });
    expect(getPublicContentRouteCheck("ujian/snbt")).toEqual({
      mode: "outside",
    });
    expect(getPublicContentRouteCheck("practice/snbt")).toEqual({
      mode: "outside",
    });
    expect(getPublicContentRouteCheck("latihan/snbt")).toEqual({
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
