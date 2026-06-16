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

  it("classifies material and curriculum routes", () => {
    expect(getPublicContentRouteCheck("subject")).toEqual({
      mode: "outside",
    });
    expect(getPublicContentRouteCheck("curriculum")).toEqual({ mode: "app" });
    expect(getPublicContentRouteCheck("material")).toEqual({ mode: "app" });
    expect(
      getPublicContentRouteCheck(
        "material/lesson/mathematics/exponential-logarithm"
      )
    ).toEqual({
      mode: "exact",
      route: "material/lesson/mathematics/exponential-logarithm",
    });
    expect(
      getPublicContentRouteCheck(
        "material/lesson/mathematics/exponential-logarithm/logarithm-definition"
      )
    ).toEqual({
      mode: "exact",
      route:
        "material/lesson/mathematics/exponential-logarithm/logarithm-definition",
    });
  });

  it("classifies assessment material routes", () => {
    expect(getPublicContentRouteCheck("exercises")).toEqual({
      mode: "outside",
    });
    expect(getPublicContentRouteCheck("assessment")).toEqual({ mode: "app" });
    expect(
      getPublicContentRouteCheck(
        "material/practice/assessment/snbt/general-reasoning/try-out-2026"
      )
    ).toEqual({
      mode: "exact",
      route: "material/practice/assessment/snbt/general-reasoning/try-out-2026",
    });
    expect(
      getPublicContentRouteCheck(
        "assessment/high-school/snbt/general-reasoning/try-out/set-1"
      )
    ).toEqual({
      mode: "app",
    });
    expect(
      getPublicContentRouteCheck(
        "material/practice/assessment/snbt/general-reasoning/try-out-2026/set-1/question-1"
      )
    ).toEqual({
      mode: "exact",
      route:
        "material/practice/assessment/snbt/general-reasoning/try-out-2026/set-1/question-1",
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
