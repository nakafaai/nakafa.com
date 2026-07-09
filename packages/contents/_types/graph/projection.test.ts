import {
  getQuranSurahNumberForRoute,
  getSourceRouteProjection,
  getSourceRouteProjectionForRoute,
  parseQuranSurahNumberForRoute,
  parseSourceRouteProjection,
} from "@repo/contents/_types/graph/projection";
import { normalizeSourceRouteProjection } from "@repo/contents/_types/graph/route";
import {
  getCurriculumLensScopeForKind,
  getSourceRegistryRootForKind,
  SourceRouteInputSchema,
  SourceRouteProjectionSchema,
} from "@repo/contents/_types/graph/schema";
import { Effect, Exit, Schema } from "effect";
import { describe, expect, it } from "vitest";

describe("source route projection", () => {
  it("projects current public routes into graph metadata", () => {
    expect(
      getSourceRouteProjectionForRoute("articles/politics/makna-demokrasi")
    ).toMatchObject({
      conceptSegments: ["article", "politics"],
      kind: "article",
      learningObjectSegments: ["article", "politics", "makna-demokrasi"],
      lensScope: "article-domain",
      lensSegments: ["article", "politics"],
      parentRoute: "articles/politics",
      sourceRoot: "articles",
    });

    expect(getSourceRouteProjectionForRoute("quran/1")).toMatchObject({
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
      getSourceRouteProjectionForRoute(
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

  it("projects try-out countries, exams, tracks, sets, and sections with named parent routes", () => {
    const countryRoute = "try-out/indonesia";
    const examRoute = `${countryRoute}/snbt`;
    const trackRoute = `${examRoute}/2027`;
    const setRoute = `${trackRoute}/set-1`;
    const sectionRoute = `${setRoute}/quantitative-knowledge`;

    expect(getSourceRouteProjectionForRoute(countryRoute)).toMatchObject({
      conceptSegments: ["tryout", "indonesia"],
      kind: "tryout-country",
      lensSegments: ["tryout", "indonesia", "catalog"],
      parentRoute: "try-out",
      sourceRoot: "tryout",
    });
    expect(getSourceRouteProjectionForRoute(examRoute)).toMatchObject({
      conceptSegments: ["tryout", "indonesia", "snbt"],
      kind: "tryout-exam",
      lensSegments: ["tryout", "indonesia", "snbt"],
      parentRoute: countryRoute,
      sourceRoot: "tryout",
    });
    expect(getSourceRouteProjectionForRoute(trackRoute)).toMatchObject({
      conceptSegments: ["tryout", "indonesia", "snbt", "2027"],
      kind: "tryout-track",
      lensSegments: ["tryout", "indonesia", "snbt"],
      parentRoute: examRoute,
      sourceRoot: "tryout",
    });
    expect(getSourceRouteProjectionForRoute(setRoute)).toMatchObject({
      conceptSegments: ["tryout", "indonesia", "snbt", "2027", "set-1"],
      kind: "tryout-set",
      lensSegments: ["tryout", "indonesia", "snbt"],
      parentRoute: trackRoute,
      sourceRoot: "tryout",
    });
    expect(getSourceRouteProjectionForRoute(sectionRoute)).toMatchObject({
      conceptSegments: [
        "tryout",
        "indonesia",
        "snbt",
        "2027",
        "quantitative-knowledge",
      ],
      kind: "tryout-section",
      lensSegments: ["tryout", "indonesia", "snbt"],
      parentRoute: setRoute,
      sourceRoot: "tryout",
    });
  });

  it("rejects malformed projections instead of inferring partial route identity", () => {
    expect(getSourceRouteProjectionForRoute("unknown/root")).toBeNull();
    expect(getSourceRouteProjectionForRoute("articles/politics")).toBeNull();
    expect(getSourceRouteProjectionForRoute("quran")).toBeNull();
    expect(getSourceRouteProjectionForRoute("try-out/malaysia")).toBeNull();
    expect(
      getSourceRouteProjectionForRoute("try-out/indonesia/unknown")
    ).toBeNull();
    expect(
      getSourceRouteProjectionForRoute(
        "try-out/indonesia/snbt/2027/set-1/unknown-section/extra"
      )
    ).toBeNull();
    expect(
      getSourceRouteProjectionForRoute(
        "try-out/indonesia/snbt/2027/set-1/extra/path"
      )
    ).toBeNull();
    expect(
      getSourceRouteProjectionForRoute("material/lesson/math/topic/one/extra")
    ).toBeNull();
    expect(getSourceRouteProjectionForRoute("quran/not-number")).toBeNull();
    expect(
      getSourceRouteProjectionForRoute(
        "try-out/indonesia/snbt/2027/set-1/quantitative-knowledge/extra"
      )
    ).toBeNull();
    expect(
      getSourceRouteProjectionForRoute("try-out/indonesia/snbt/set-1")
    ).toBeNull();
    expect(
      getSourceRouteProjectionForRoute(
        "try-out/indonesia/snbt/set-1/quantitative-knowledge"
      )
    ).toBeNull();
    expect(
      getSourceRouteProjectionForRoute("try-out/indonesia/snbt/2027")
    ).toMatchObject({ kind: "tryout-track" });
    expect(
      getSourceRouteProjectionForRoute("try-out/indonesia/snbt/2027/set-1")
    ).toMatchObject({ kind: "tryout-set" });
    expect(
      getSourceRouteProjectionForRoute(
        "try-out/indonesia/snbt/2027/set-1/quantitative-knowledge"
      )
    ).toMatchObject({ kind: "tryout-section" });
    expect(
      getSourceRouteProjectionForRoute(
        "try-out/indonesia/snbt/2027/set-2/general-reasoning"
      )
    ).toMatchObject({ kind: "tryout-section" });
    expect(getSourceRouteProjectionForRoute("material/video/topic")).toBeNull();
    expect(
      getSourceRouteProjectionForRoute("try-out/indonesia/snbt/2027/set-1/1")
    ).toBeNull();
    expect(
      getSourceRouteProjectionForRoute("try-out/indonesia/snbt/2027/missing")
    ).toBeNull();
    expect(
      getSourceRouteProjectionForRoute(
        "try-out/indonesia/snbt/2027/set-1/missing"
      )
    ).toBeNull();
    expect(
      getSourceRouteProjectionForRoute(
        "try-out/indonesia/tka/matematika/set-1/matematika"
      )
    ).toBeNull();
    expect(
      getSourceRouteProjectionForRoute("try-out/indonesia/tka/matematika/set-1")
    ).toMatchObject({ kind: "tryout-set" });
  });

  it("keeps declared kind validation next to the projection spec", () => {
    const topicRoute = "material/lesson/physics/waves";

    expect(
      getSourceRouteProjection({
        kind: "curriculum-topic",
        route: topicRoute,
      })?.kind
    ).toBe("curriculum-topic");
    expect(
      getSourceRouteProjection({
        kind: "curriculum-lesson",
        route: topicRoute,
      })
    ).toBeNull();
  });

  it("owns projection and parser contracts through Effect schemas", async () => {
    const source = Schema.decodeUnknownSync(SourceRouteInputSchema)({
      kind: "quran-surah",
      route: "quran/1",
    });

    expect(Schema.is(SourceRouteInputSchema)(source)).toBe(true);

    const projection = getSourceRouteProjection(source);

    expect(projection).not.toBeNull();
    expect(Schema.is(SourceRouteProjectionSchema)(projection)).toBe(true);

    const parsed = await Effect.runPromiseExit(
      parseSourceRouteProjection(source)
    );

    expect(Exit.isSuccess(parsed)).toBe(true);
    if (Exit.isFailure(parsed)) {
      return;
    }

    expect(parsed.value.kind).toBe("quran-surah");
    expect(
      await Effect.runPromise(parseQuranSurahNumberForRoute("quran/1"))
    ).toBe(1);
  });

  it("keeps parse failures typed without throwing from the parser API", async () => {
    const parsed = await Effect.runPromiseExit(
      parseSourceRouteProjection({
        kind: "quran-surah",
        route: "quran/not-number",
      })
    );
    const quranParsed = await Effect.runPromiseExit(
      parseQuranSurahNumberForRoute("quran/not-number")
    );

    expect(Exit.isFailure(parsed)).toBe(true);
    expect(Exit.isFailure(quranParsed)).toBe(true);
  });

  it("decodes unknown source-route inputs before projection parsing", async () => {
    const missingRoute = await Effect.runPromiseExit(
      parseSourceRouteProjection({ kind: "quran-surah" })
    );
    const missingKind = await Effect.runPromiseExit(
      parseSourceRouteProjection({ route: "quran/1" })
    );
    const nonStringFields = await Effect.runPromiseExit(
      parseSourceRouteProjection({ kind: 1, route: 1 })
    );
    const numericQuranRoute = await Effect.runPromiseExit(
      parseQuranSurahNumberForRoute(1)
    );

    expect(Exit.isFailure(missingRoute)).toBe(true);
    expect(Exit.isFailure(missingKind)).toBe(true);
    expect(Exit.isFailure(nonStringFields)).toBe(true);
    expect(Exit.isFailure(numericQuranRoute)).toBe(true);
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

  it("owns Quran route selectors used by agent readers", () => {
    expect(getQuranSurahNumberForRoute("quran/1")).toBe(1);
    expect(getQuranSurahNumberForRoute("articles/politics/example")).toBeNull();
  });

  it("normalizes noisy projections before matching", () => {
    expect(normalizeSourceRouteProjection("//quran//1/")).toBe("quran/1");
    expect(getSourceRouteProjectionForRoute("//quran//1/")?.route).toBe(
      "quran/1"
    );
  });
});
