import {
  getExerciseSetGroupRoute,
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
        "subject/high-school/10/chemistry/atomic-structure/electron-configuration"
      )
    ).toMatchObject({
      conceptSegments: ["subject", "chemistry", "atomic-structure"],
      kind: "subject-section",
      lensScope: "curriculum",
      lensSegments: ["subject", "high-school", "10", "chemistry"],
      parentRoute: "subject/high-school/10/chemistry/atomic-structure",
      sourceRoot: "subject",
    });
  });

  it("projects exercise groups, sets, and questions with named parent routes", () => {
    const groupRoute =
      "exercises/high-school/snbt/quantitative-knowledge/try-out/2026";
    const setRoute = `${groupRoute}/set-1`;
    const questionRoute = `${setRoute}/7`;
    const shortGroupRoute =
      "exercises/high-school/snbt/quantitative-knowledge/practice";
    const shortSetRoute = `${shortGroupRoute}/set-1`;
    const shortQuestionRoute = `${shortSetRoute}/7`;

    expect(getSourceRouteProjectionForRoute(groupRoute)).toMatchObject({
      exercise: {
        groupRoute,
        groupSegments: ["try-out", "2026"],
      },
      kind: "exercise-group",
      parentRoute: "exercises/high-school/snbt/quantitative-knowledge",
    });
    expect(getSourceRouteProjectionForRoute(setRoute)).toMatchObject({
      exercise: {
        groupRoute,
        setRoute,
        setSegment: "set-1",
      },
      kind: "exercise-set",
      parentRoute: groupRoute,
    });
    expect(getSourceRouteProjectionForRoute(questionRoute)).toMatchObject({
      exercise: {
        groupRoute,
        questionSegment: "7",
        setRoute,
        setSegment: "set-1",
      },
      kind: "exercise-question",
      parentRoute: setRoute,
    });
    expect(getSourceRouteProjectionForRoute(shortGroupRoute)).toMatchObject({
      exercise: {
        groupRoute: shortGroupRoute,
        groupSegments: ["practice"],
      },
      kind: "exercise-group",
      parentRoute: "exercises/high-school/snbt/quantitative-knowledge",
    });
    expect(getSourceRouteProjectionForRoute(shortSetRoute)).toMatchObject({
      exercise: {
        groupRoute: shortGroupRoute,
        setRoute: shortSetRoute,
        setSegment: "set-1",
      },
      kind: "exercise-set",
      parentRoute: shortGroupRoute,
    });
    expect(getSourceRouteProjectionForRoute(shortQuestionRoute)).toMatchObject({
      exercise: {
        groupRoute: shortGroupRoute,
        questionSegment: "7",
        setRoute: shortSetRoute,
        setSegment: "set-1",
      },
      kind: "exercise-question",
      parentRoute: shortSetRoute,
    });
    expect(getExerciseSetGroupRoute(setRoute)).toBe(groupRoute);
    expect(getExerciseSetGroupRoute(shortSetRoute)).toBe(shortGroupRoute);
  });

  it("rejects malformed projections instead of inferring partial route identity", () => {
    expect(getSourceRouteProjectionForRoute("quran")).toBeNull();
    expect(
      getSourceRouteProjectionForRoute("exercises/high-school")
    ).toBeNull();
    expect(getSourceRouteProjectionForRoute("exercises/set-1/7")).toBeNull();
    expect(
      getSourceRouteProjectionForRoute(
        "subject/high-school/10/math/topic/one/extra"
      )
    ).toBeNull();
    expect(getSourceRouteProjectionForRoute("quran/not-number")).toBeNull();
    expect(
      getSourceRouteProjectionForRoute(
        "exercises/high-school/snbt/quantitative-knowledge/try-out/2026/not-a-set/extra"
      )
    ).toBeNull();
    expect(
      getSourceRouteProjectionForRoute(
        "exercises/high-school/snbt/quantitative-knowledge/practice/set-1/7/extra"
      )
    ).toBeNull();
    expect(
      getExerciseSetGroupRoute("exercises/high-school/snbt/set-1/7")
    ).toBeNull();
  });

  it("keeps declared kind validation next to the projection spec", () => {
    const topicRoute = "subject/high-school/10/physics/waves";

    expect(
      getSourceRouteProjection({
        kind: "subject-topic",
        route: topicRoute,
      })?.kind
    ).toBe("subject-topic");
    expect(
      getSourceRouteProjection({
        kind: "subject-section",
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
    expect(getSourceRegistryRootForKind("exercise-question")).toBe("exercises");
    expect(getSourceRegistryRootForKind("quran-surah")).toBe("quran");
    expect(getCurriculumLensScopeForKind("subject-section")).toBe("curriculum");
    expect(getCurriculumLensScopeForKind("exercise-set")).toBe("exam");
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
