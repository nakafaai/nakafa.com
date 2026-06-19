import {
  getExerciseQuestionRouteForNumber,
  getExerciseSetGroupRoute,
  getExerciseSetRoute,
  getQuranSurahNumberForRoute,
  getSourceRouteProjection,
  getSourceRouteProjectionForRoute,
  parseQuranSurahNumberForRoute,
  parseSourceRouteProjection,
} from "@repo/contents/_types/graph/projection";
import {
  getExerciseQuestionNumberSegment,
  getExerciseQuestionSegment,
  normalizeSourceRouteProjection,
} from "@repo/contents/_types/graph/route";
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

  it("projects exercise groups, sets, and questions with named parent routes", () => {
    const groupRoute =
      "material/practice/assessment/snbt/quantitative-knowledge/try-out-2026";
    const setRoute = `${groupRoute}/set-1`;
    const questionRoute = `${setRoute}/7`;

    expect(getSourceRouteProjectionForRoute(groupRoute)).toMatchObject({
      exercise: {
        groupRoute,
        groupSegments: ["try-out-2026"],
      },
      kind: "exercise-group",
      parentRoute: "material/practice/assessment/snbt/quantitative-knowledge",
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
    expect(getExerciseSetGroupRoute(setRoute)).toBe(groupRoute);
    expect(getExerciseSetRoute(setRoute)).toBe(setRoute);
    expect(getExerciseSetRoute(questionRoute)).toBe(setRoute);
    expect(getExerciseQuestionRouteForNumber(setRoute, 7)).toBe(questionRoute);
    expect(getExerciseQuestionRouteForNumber(questionRoute, 7)).toBe(
      questionRoute
    );
  });

  it("rejects malformed projections instead of inferring partial route identity", () => {
    const setRoute =
      "material/practice/assessment/snbt/quantitative-knowledge/practice/set-1";
    const questionRoute = `${setRoute}/question-7`;

    expect(getSourceRouteProjectionForRoute("quran")).toBeNull();
    expect(
      getSourceRouteProjectionForRoute("material/practice/assessment")
    ).toBeNull();
    expect(
      getSourceRouteProjectionForRoute("material/practice/set-1/question-7")
    ).toBeNull();
    expect(
      getSourceRouteProjectionForRoute("material/lesson/math/topic/one/extra")
    ).toBeNull();
    expect(getSourceRouteProjectionForRoute("quran/not-number")).toBeNull();
    expect(
      getSourceRouteProjectionForRoute(
        "material/practice/assessment/snbt/quantitative-knowledge/try-out-2026/not-a-set/extra"
      )
    ).toBeNull();
    expect(
      getSourceRouteProjectionForRoute(
        "material/practice/assessment/snbt/quantitative-knowledge/try-out-2026/not-a-set"
      )
    ).toMatchObject({
      kind: "exercise-group",
    });
    expect(
      getSourceRouteProjectionForRoute(
        "material/practice/assessment/snbt/quantitative-knowledge/try-out-2026/practice/set-1"
      )
    ).toMatchObject({
      kind: "exercise-set",
    });
    expect(
      getSourceRouteProjectionForRoute(
        "material/practice/assessment/snbt/quantitative-knowledge/practice/set-1/question-7/extra"
      )
    ).toBeNull();
    expect(
      getSourceRouteProjectionForRoute(
        "material/practice/assessment/grade-9/numeracy/practice/set-1"
      )
    ).toMatchObject({
      exercise: {
        categorySegment: "middle-school",
      },
    });
    expect(getSourceRouteProjectionForRoute("material/video/topic")).toBeNull();
    expect(
      getExerciseSetGroupRoute(
        "material/practice/assessment/snbt/set-1/question-7"
      )
    ).toBeNull();
    expect(
      getExerciseSetRoute(
        "material/practice/assessment/snbt/quantitative-knowledge/practice"
      )
    ).toBeNull();
    expect(
      getExerciseSetRoute(
        "material/practice/assessment/snbt/quantitative-knowledge/practice/not-a-set"
      )
    ).toBeNull();
    expect(
      getExerciseQuestionRouteForNumber(
        "material/practice/assessment/snbt/quantitative-knowledge/practice",
        7
      )
    ).toBeNull();
    expect(
      getExerciseQuestionRouteForNumber("articles/politics/example", 7)
    ).toBeNull();
    expect(getExerciseQuestionRouteForNumber("quran/1", 7)).toBeNull();
    expect(getExerciseQuestionRouteForNumber(setRoute, 0)).toBeNull();
    expect(getExerciseQuestionRouteForNumber(questionRoute, 8)).toBeNull();
    expect(getExerciseQuestionNumberSegment("question-x")).toBeNull();
    expect(getExerciseQuestionNumberSegment("7")).toBe("7");
    expect(getExerciseQuestionSegment(0)).toBeNull();
    expect(getExerciseQuestionSegment(7)).toBe("7");
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
    expect(getSourceRegistryRootForKind("exercise-question")).toBe("material");
    expect(getSourceRegistryRootForKind("quran-surah")).toBe("quran");
    expect(getCurriculumLensScopeForKind("curriculum-lesson")).toBe(
      "curriculum"
    );
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
