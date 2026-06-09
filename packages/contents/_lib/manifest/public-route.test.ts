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

  it("classifies subject listing, chapter, and lesson routes", () => {
    expect(getPublicContentRouteCheck("subject")).toEqual({ mode: "app" });
    expect(getPublicContentRouteCheck("subject/high-school")).toEqual({
      mode: "missing",
    });
    expect(getPublicContentRouteCheck("subject/high-school/missing")).toEqual({
      mode: "missing",
    });
    expect(getPublicContentRouteCheck("subject/high-school/10")).toEqual({
      mode: "subject-grade",
      prefix: "subject/high-school/10",
    });
    expect(
      getPublicContentRouteCheck("subject/high-school/10/missing")
    ).toEqual({
      mode: "missing",
    });
    expect(
      getPublicContentRouteCheck("subject/high-school/10/mathematics")
    ).toEqual({
      mode: "subject-material",
      parentRoute: "subject/high-school/10/mathematics",
    });
    expect(
      getPublicContentRouteCheck(
        "subject/high-school/10/mathematics/exponential-logarithm"
      )
    ).toEqual({
      mode: "exact",
      route: "subject/high-school/10/mathematics/exponential-logarithm",
    });
    expect(
      getPublicContentRouteCheck(
        "subject/high-school/10/mathematics/exponential-logarithm/logarithm-definition"
      )
    ).toEqual({
      mode: "exact",
      route:
        "subject/high-school/10/mathematics/exponential-logarithm/logarithm-definition",
    });
  });

  it("classifies exercise listing, group, set, and question routes", () => {
    expect(getPublicContentRouteCheck("exercises")).toEqual({ mode: "app" });
    expect(getPublicContentRouteCheck("exercises/high-school")).toEqual({
      mode: "missing",
    });
    expect(getPublicContentRouteCheck("exercises/high-school/missing")).toEqual(
      {
        mode: "missing",
      }
    );
    expect(getPublicContentRouteCheck("exercises/high-school/snbt")).toEqual({
      mode: "exercise-type",
      prefix: "exercises/high-school/snbt/",
    });
    expect(
      getPublicContentRouteCheck("exercises/high-school/snbt/missing")
    ).toEqual({
      mode: "missing",
    });
    expect(
      getPublicContentRouteCheck("exercises/high-school/snbt/general-reasoning")
    ).toEqual({
      mode: "exercise-material",
      parentRoute: "exercises/high-school/snbt/general-reasoning",
    });
    expect(
      getPublicContentRouteCheck(
        "exercises/high-school/snbt/general-reasoning/try-out/2026"
      )
    ).toEqual({
      mode: "exact",
      route: "exercises/high-school/snbt/general-reasoning/try-out/2026",
    });
    expect(
      getPublicContentRouteCheck(
        "exercises/high-school/snbt/general-reasoning/try-out/set-1"
      )
    ).toEqual({
      mode: "missing",
    });
    expect(
      getPublicContentRouteCheck(
        "exercises/high-school/snbt/general-reasoning/try-out/2026/set-1/1"
      )
    ).toEqual({
      mode: "exact",
      route:
        "exercises/high-school/snbt/general-reasoning/try-out/2026/set-1/1",
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
