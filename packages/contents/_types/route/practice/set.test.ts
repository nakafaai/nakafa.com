import { MATERIAL_ROUTE_DOMAINS } from "@repo/contents/_types/material/domain";
import { MATERIAL_SOURCES } from "@repo/contents/_types/material/source";
import {
  isPracticeSetRoute,
  listPublicContentRoutes,
} from "@repo/contents/_types/route/content";
import { readPublicPracticeSetRouteByPath } from "@repo/contents/_types/route/practice/set";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

describe("practice set routes", () => {
  it("resolves canonical public set paths to source set paths", () => {
    const routes = Effect.runSync(listPublicContentRoutes());

    expect(routes).toContainEqual(
      expect.objectContaining({
        kind: "exercise-set",
        locale: "id",
        publicPath: "latihan/snbt/pengetahuan-kuantitatif/tryout-2026/set-1",
        sourcePath:
          "material/practice/assessment/snbt/quantitative-knowledge/try-out-2026/set-1",
      })
    );
    expect(
      readPublicPracticeSetRouteByPath({
        domains: MATERIAL_ROUTE_DOMAINS,
        locale: "en",
        materials: MATERIAL_SOURCES,
        publicPath: "practice/snbt/quantitative-knowledge/mock-test-2026/set-1",
      })
    ).toEqual({
      kind: "set",
      sourcePath:
        "material/practice/assessment/snbt/quantitative-knowledge/try-out-2026/set-1",
    });
    expect(
      readPublicPracticeSetRouteByPath({
        locale: "id",
        publicPath: "latihan/snbt/pengetahuan-kuantitatif/tryout-2026/set-1",
      })
    ).toEqual({
      kind: "set",
      sourcePath:
        "material/practice/assessment/snbt/quantitative-knowledge/try-out-2026/set-1",
    });
  });

  it("rejects question paths and stale split group paths", () => {
    const routes = Effect.runSync(listPublicContentRoutes());

    expect(
      routes
        .filter(isPracticeSetRoute)
        .some(
          (route) =>
            route.publicPath ===
            "practice/snbt/quantitative-knowledge/mock-test-2026/set-1"
        )
    ).toBe(true);
    expect(
      readPublicPracticeSetRouteByPath({
        locale: "en",
        publicPath:
          "practice/snbt/quantitative-knowledge/mock-test-2026/set-1/question-1",
      })
    ).toBeUndefined();
    expect(
      readPublicPracticeSetRouteByPath({
        locale: "en",
        publicPath: "practice/snbt/quantitative-knowledge/mock-test/2026/set-1",
      })
    ).toBeUndefined();
  });
});
