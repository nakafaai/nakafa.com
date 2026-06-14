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

  it("separates subject concepts from curriculum lenses", () => {
    const topic = readGraphIdentityFixture({
      kind: "subject-topic",
      locale: "id",
      route: "subject/high-school/10/chemistry/atomic-structure",
    });
    const section = readGraphIdentityFixture({
      kind: "subject-section",
      locale: "id",
      route:
        "subject/high-school/10/chemistry/atomic-structure/electron-configuration",
    });

    expect(topic.lensId).toBe("lens:subject:high-school:10:chemistry");
    expect(section.lensId).toBe(topic.lensId);
    expect(topic.conceptId).toBe("concept:subject:chemistry:atomic-structure");
    expect(section.conceptId).toBe(topic.conceptId);
    expect(section.learningObjectId).toBe(
      "lo:subject-section:chemistry:atomic-structure:electron-configuration"
    );
  });

  it("keeps locale assets unique across curriculum lenses", () => {
    const grade10 = readGraphIdentityFixture({
      kind: "subject-topic",
      locale: "id",
      route: "subject/high-school/10/mathematics/functions",
    });
    const grade11 = readGraphIdentityFixture({
      kind: "subject-topic",
      locale: "id",
      route: "subject/high-school/11/mathematics/functions",
    });

    expect(grade10.conceptId).toBe(grade11.conceptId);
    expect(grade10.assetId).not.toBe(grade11.assetId);
  });

  it("keeps exam alignment separate from concrete exercise objects", () => {
    const group = readGraphIdentityFixture({
      kind: "exercise-group",
      locale: "en",
      route: "exercises/high-school/snbt/quantitative-knowledge/try-out/2026",
    });
    const set = readGraphIdentityFixture({
      kind: "exercise-set",
      locale: "en",
      route:
        "exercises/high-school/snbt/quantitative-knowledge/try-out/2026/set-1",
    });
    const question = readGraphIdentityFixture({
      kind: "exercise-question",
      locale: "en",
      route:
        "exercises/high-school/snbt/quantitative-knowledge/try-out/2026/set-1/7",
    });

    expect(group.lensId).toBe(
      "lens:exercise:high-school:snbt:quantitative-knowledge"
    );
    expect(set.lensId).toBe(group.lensId);
    expect(question.lensId).toBe(group.lensId);
    expect(question.assetId).toBe(
      "asset:en:exercise:high-school:snbt:quantitative-knowledge:exercise-question:snbt:quantitative-knowledge:try-out:2026:set-1:7"
    );
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
    expect(
      getLearningObjectKindForRoute("subject/high-school/10/physics/waves")
    ).toBe("subject-topic");
    expect(
      getLearningObjectKindForRoute(
        "subject/high-school/10/physics/waves/sound"
      )
    ).toBe("subject-section");
    expect(
      getLearningObjectKindForRoute(
        "exercises/high-school/snbt/quantitative-knowledge/try-out/2026"
      )
    ).toBe("exercise-group");
    expect(
      getLearningObjectKindForRoute(
        "exercises/high-school/snbt/quantitative-knowledge/try-out/2026/set-1"
      )
    ).toBe("exercise-set");
    expect(
      getLearningObjectKindForRoute(
        "exercises/high-school/snbt/quantitative-knowledge/try-out/2026/set-1/7"
      )
    ).toBe("exercise-question");
    expect(getLearningObjectKindForRoute("exercises/high-school")).toBeNull();
    expect(getLearningObjectKindForRoute("exercises/set-1/7")).toBeNull();
    expect(
      getLearningObjectKindForRoute(
        "exercises/high-school/snbt/quantitative-knowledge/try-out/2026/not-a-set/extra"
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
        route: "exercises/set-1/7",
      })
    ).toBeNull();
  });

  it("exposes nonthrowing and Effect-native declared source parsers", async () => {
    const source = {
      kind: "subject-topic",
      locale: "id",
      route: "subject/high-school/10/physics/waves",
    } as const;
    const invalidSource = {
      ...source,
      kind: "subject-section",
    } as const;

    expect(getLearningGraphIdentity(source)?.lensId).toBe(
      "lens:subject:high-school:10:physics"
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
        kind: "subject-section",
        locale: "id",
        route: "subject/high-school/10/physics/waves/sound",
      })
    ).toEqual(["subject", "high-school", "10", "physics"]);
  });

  it("rejects graph identity without throwing when kind does not match route shape", async () => {
    const source = {
      kind: "subject-section",
      locale: "id",
      route: "subject/high-school/10/physics/waves",
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
