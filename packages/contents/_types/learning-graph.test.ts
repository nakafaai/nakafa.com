import {
  buildGraphId,
  createLearningGraphIdentityFromRoute,
  getLearningGraphIdentity,
  getLearningGraphLensSegments,
  getLearningObjectKindForRoute,
  type LearningGraphIdentity,
  type LearningGraphSource,
  normalizeGraphRoute,
  parseLearningGraphIdentity,
} from "@repo/contents/_types/learning-graph";
import { Effect, Exit } from "effect";
import { describe, expect, it } from "vitest";

describe("learning graph identity", () => {
  it("maps article sources into locale asset identity and route-free graph IDs", () => {
    const identity = readGraphIdentityFixture({
      kind: "article",
      locale: "id",
      route: "/articles/politics/makna-demokrasi",
    });

    expect(identity).toEqual({
      alignmentId:
        "alignment:article:politics:article:politics:makna-demokrasi",
      assetId: "asset:id:article:politics:article:politics:makna-demokrasi",
      conceptId: "concept:article:politics",
      learningObjectId: "lo:article:politics:makna-demokrasi",
      lensId: "lens:article:politics",
    });
  });

  it("separates material concepts from material lenses", () => {
    const topic = readGraphIdentityFixture({
      kind: "curriculum-topic",
      locale: "id",
      route: "material/lesson/chemistry/atomic-structure",
    });
    const section = readGraphIdentityFixture({
      kind: "curriculum-lesson",
      locale: "id",
      route:
        "material/lesson/chemistry/atomic-structure/electron-configuration",
    });

    expect(topic.lensId).toBe("lens:material:lesson:chemistry");
    expect(section.lensId).toBe(topic.lensId);
    expect(topic.conceptId).toBe(
      "concept:material:lesson:chemistry:atomic-structure"
    );
    expect(section.conceptId).toBe(topic.conceptId);
    expect(section.learningObjectId).toBe(
      "lo:material-section:chemistry:atomic-structure:electron-configuration"
    );
  });

  it("keeps reusable material assets stable outside curriculum structure", () => {
    const first = readGraphIdentityFixture({
      kind: "curriculum-topic",
      locale: "id",
      route: "material/lesson/mathematics/functions",
    });
    const second = readGraphIdentityFixture({
      kind: "curriculum-topic",
      locale: "id",
      route: "material/lesson/mathematics/functions",
    });

    expect(first.conceptId).toBe(second.conceptId);
    expect(first.assetId).toBe(second.assetId);
  });

  it("keeps exam alignment separate from concrete try-out objects", () => {
    const exam = readGraphIdentityFixture({
      kind: "tryout-exam",
      locale: "en",
      route: "try-out/indonesia/snbt",
    });
    const track = readGraphIdentityFixture({
      kind: "tryout-track",
      locale: "en",
      route: "try-out/indonesia/snbt/2027",
    });
    const set = readGraphIdentityFixture({
      kind: "tryout-set",
      locale: "en",
      route: "try-out/indonesia/snbt/2027/set-1",
    });
    const section = readGraphIdentityFixture({
      kind: "tryout-section",
      locale: "en",
      route: "try-out/indonesia/snbt/2027/set-1/quantitative-knowledge",
    });

    expect(exam.lensId).toBe("lens:tryout:indonesia:snbt");
    expect(track.lensId).toBe(exam.lensId);
    expect(set.lensId).toBe(exam.lensId);
    expect(section.lensId).toBe(exam.lensId);
    expect(section.assetId).toBe(
      "asset:en:tryout:indonesia:snbt:tryout-section:indonesia:snbt:2027:set-1:quantitative-knowledge"
    );
  });

  it("keeps non-locale graph IDs stable across localized try-out routes", () => {
    const english = readGraphIdentityFixture({
      kind: "tryout-track",
      locale: "en",
      route: "try-out/indonesia/tka/mathematics",
    });
    const indonesian = readGraphIdentityFixture({
      kind: "tryout-track",
      locale: "id",
      route: "try-out/indonesia/tka/matematika",
    });

    expect({
      alignmentId: indonesian.alignmentId,
      conceptId: indonesian.conceptId,
      learningObjectId: indonesian.learningObjectId,
      lensId: indonesian.lensId,
    }).toEqual({
      alignmentId: english.alignmentId,
      conceptId: english.conceptId,
      learningObjectId: english.learningObjectId,
      lensId: english.lensId,
    });
    expect(english.learningObjectId).toBe(
      "lo:tryout-track:indonesia:tka:mathematics"
    );
    expect(english.assetId).not.toBe(indonesian.assetId);
  });

  it("supports non-route Quran graph identity", () => {
    expect(
      readGraphIdentityFixture({
        kind: "quran-surah",
        locale: "id",
        route: "quran/1",
      })
    ).toMatchObject({
      conceptId: "concept:quran:surah:1",
      learningObjectId: "lo:quran-surah:1",
      lensId: "lens:quran",
    });
  });

  it("normalizes route projections before identity derivation", () => {
    expect(normalizeGraphRoute("//articles//politics/example/")).toBe(
      "articles/politics/example"
    );
  });

  it("builds clean graph IDs from normalized segments", () => {
    expect(buildGraphId("concept", ["", "/math/", "functions"])).toBe(
      "concept:math:functions"
    );
    expect(buildGraphId("lens", [])).toBe("lens");
  });

  it("infers graph kind from route projections", () => {
    expect(getLearningObjectKindForRoute("articles/politics/example")).toBe(
      "article"
    );
    expect(getLearningObjectKindForRoute("quran/1")).toBe("quran-surah");
    expect(getLearningObjectKindForRoute("quran/not-number")).toBeNull();
    expect(getLearningObjectKindForRoute("material/lesson/physics/waves")).toBe(
      "curriculum-topic"
    );
    expect(
      getLearningObjectKindForRoute("material/lesson/physics/waves/sound")
    ).toBe("curriculum-lesson");
    expect(getLearningObjectKindForRoute("try-out/indonesia")).toBe(
      "tryout-country"
    );
    expect(getLearningObjectKindForRoute("try-out/indonesia/snbt")).toBe(
      "tryout-exam"
    );
    expect(getLearningObjectKindForRoute("try-out/indonesia/snbt/2027")).toBe(
      "tryout-track"
    );
    expect(
      getLearningObjectKindForRoute("try-out/indonesia/snbt/2027/set-1")
    ).toBe("tryout-set");
    expect(
      getLearningObjectKindForRoute(
        "try-out/indonesia/snbt/2027/set-1/quantitative-knowledge"
      )
    ).toBe("tryout-section");
    expect(getLearningObjectKindForRoute("assessment/high-school")).toBeNull();
    expect(getLearningObjectKindForRoute("assessment/set-1/7")).toBeNull();
    expect(
      getLearningObjectKindForRoute(
        "try-out/indonesia/snbt/2027/set-1/quantitative-knowledge/extra"
      )
    ).toBeNull();
  });

  it("creates identity from route projections when kind is inferable", () => {
    expect(
      createLearningGraphIdentityFromRoute({
        locale: "id",
        route: "articles/politics/example",
      })?.assetId
    ).toBe("asset:id:article:politics:article:politics:example");
    expect(
      createLearningGraphIdentityFromRoute({
        locale: "id",
        route: "articles",
      })
    ).toBeNull();
    expect(
      createLearningGraphIdentityFromRoute({
        locale: "en",
        route: "assessment/set-1/7",
      })
    ).toBeNull();
  });

  it("exposes nonthrowing and Effect-native declared source parsers", async () => {
    const source = {
      kind: "curriculum-topic",
      locale: "id",
      route: "material/lesson/physics/waves",
    } as const;
    const invalidSource = {
      ...source,
      kind: "curriculum-lesson",
    } as const;

    expect(getLearningGraphIdentity(source)?.lensId).toBe(
      "lens:material:lesson:physics"
    );
    expect(getLearningGraphIdentity(invalidSource)).toBeNull();

    const parsed = await Effect.runPromiseExit(
      parseLearningGraphIdentity(source)
    );
    const invalidParsed = await Effect.runPromiseExit(
      parseLearningGraphIdentity(invalidSource)
    );

    expect(Exit.isSuccess(parsed)).toBe(true);
    expect(Exit.isFailure(invalidParsed)).toBe(true);
  });

  it("exposes curriculum lens segments without route identity", () => {
    expect(
      getLearningGraphLensSegments({
        kind: "curriculum-lesson",
        locale: "id",
        route: "material/lesson/physics/waves/sound",
      })
    ).toEqual(["material", "lesson", "physics"]);
  });

  it("rejects graph identity without throwing when kind does not match route shape", async () => {
    const source = {
      kind: "curriculum-lesson",
      locale: "id",
      route: "material/lesson/physics/waves",
    } as const;

    expect(getLearningGraphIdentity(source)).toBeNull();
    expect(
      Exit.isFailure(
        await Effect.runPromiseExit(parseLearningGraphIdentity(source))
      )
    ).toBe(true);
  });

  it("decodes unknown graph source inputs before identity parsing", async () => {
    const missingLocale = await Effect.runPromiseExit(
      parseLearningGraphIdentity({
        kind: "quran-surah",
        route: "quran/1",
      })
    );
    const missingRoute = await Effect.runPromiseExit(
      parseLearningGraphIdentity({
        kind: "quran-surah",
        locale: "id",
      })
    );
    const nonStringRoute = await Effect.runPromiseExit(
      parseLearningGraphIdentity({
        kind: "quran-surah",
        locale: "id",
        route: 1,
      })
    );

    expect(Exit.isFailure(missingLocale)).toBe(true);
    expect(Exit.isFailure(missingRoute)).toBe(true);
    expect(Exit.isFailure(nonStringRoute)).toBe(true);
  });
});

function readGraphIdentityFixture(
  source: LearningGraphSource
): LearningGraphIdentity {
  const identity = getLearningGraphIdentity(source);

  if (!identity) {
    throw new Error(`Expected graph identity fixture for ${source.route}.`);
  }

  return identity;
}
