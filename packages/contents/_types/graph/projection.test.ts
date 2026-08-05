import {
  getSourceRouteProjection,
  getSourceRouteProjectionForRoute,
} from "@repo/contents/_types/graph/projection";
import { normalizeSourceRouteProjection } from "@repo/contents/_types/graph/route";
import {
  getCurriculumLensScopeForKind,
  getSourceRegistryRootForKind,
  SourceRouteProjectionSchema,
} from "@repo/contents/_types/graph/schema";
import { Schema } from "effect";
import { describe, expect, it } from "vitest";

/** Projects one route through the local source graph contract. */
function getProjection(route: string) {
  return getSourceRouteProjectionForRoute(route);
}

describe("source route projection", () => {
  it("projects current public routes into graph metadata", () => {
    expect(getProjection("articles/politics/makna-demokrasi")).toMatchObject({
      conceptSegments: ["article", "politics"],
      kind: "article",
      learningObjectSegments: ["article", "politics", "makna-demokrasi"],
      lensScope: "article-domain",
      lensSegments: ["article", "politics"],
      parentRoute: "articles/politics",
      sourceRoot: "articles",
    });

    expect(getProjection("quran/1")).toMatchObject({
      conceptSegments: ["quran", "surah", "1"],
      kind: "quran-surah",
      learningObjectSegments: ["quran-surah", "1"],
      lensScope: "scripture",
      lensSegments: ["quran"],
      parentRoute: "quran",
      quran: { surahSegment: "1" },
      sourceRoot: "quran",
    });

    expect(
      getProjection(
        "material/lesson/chemistry/atomic-structure/electron-configuration"
      )
    ).toMatchObject({
      conceptSegments: ["material", "lesson", "chemistry", "atomic-structure"],
      kind: "curriculum-lesson",
      lensScope: "curriculum",
      lensSegments: ["material", "lesson", "chemistry"],
      parentRoute: "material/lesson/chemistry/atomic-structure",
      sourceRoot: "material",
    });
  });

  it("rejects malformed projections instead of inferring partial route identity", () => {
    expect(getProjection("unknown/root")).toBeNull();
    expect(getProjection("articles/politics")).toBeNull();
    expect(getProjection("quran")).toBeNull();
    expect(getProjection("try-out/indonesia/snbt")).toBeNull();
    expect(getProjection("material/lesson/math/topic/one/extra")).toBeNull();
    expect(getProjection("material/video/topic")).toBeNull();
    expect(getProjection("quran/not-number")).toBeNull();
  });

  it("keeps declared kind validation next to the projection spec", () => {
    const topicRoute = "material/lesson/physics/waves";

    expect(
      getSourceRouteProjection({
        kind: "curriculum-topic",
        locale: "id",
        route: topicRoute,
      })?.kind
    ).toBe("curriculum-topic");
    expect(
      getSourceRouteProjection({
        kind: "curriculum-lesson",
        locale: "id",
        route: topicRoute,
      })
    ).toBeNull();
  });

  it("emits projections that satisfy the runtime schema", () => {
    const projection = getSourceRouteProjection({
      kind: "quran-surah",
      locale: "id",
      route: "quran/1",
    });

    expect(projection).not.toBeNull();
    expect(Schema.is(SourceRouteProjectionSchema)(projection)).toBe(true);
  });

  it("owns registry roots and lens scopes for graph kinds", () => {
    expect(getSourceRegistryRootForKind("article")).toBe("articles");
    expect(getSourceRegistryRootForKind("tryout-section")).toBe("tryout");
    expect(getSourceRegistryRootForKind("quran-surah")).toBe("quran");
    expect(getCurriculumLensScopeForKind("curriculum-lesson")).toBe(
      "curriculum"
    );
    expect(getCurriculumLensScopeForKind("tryout-set")).toBe("exam");
    expect(getCurriculumLensScopeForKind("tryout-track")).toBe("exam");
  });

  it("normalizes noisy projections before matching", () => {
    expect(normalizeSourceRouteProjection("//quran//1/")).toBe("quran/1");
    expect(getProjection("//quran//1/")?.route).toBe("quran/1");
  });
});
