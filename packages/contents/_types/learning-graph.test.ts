import {
  createLearningGraphIdentityFromRoute,
  getLearningGraphIdentity,
  type LearningGraphIdentity,
  type LearningGraphSource,
  normalizeGraphRoute,
} from "@repo/contents/_types/learning-graph";
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

  it("returns null when the declared kind does not match the route", () => {
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
  });
});

/** Decode one graph-identity fixture from a learning graph source. */
function readGraphIdentityFixture(
  source: LearningGraphSource
): LearningGraphIdentity {
  const identity = getLearningGraphIdentity(source);

  if (!identity) {
    throw new Error(`Expected graph identity fixture for ${source.route}.`);
  }

  return identity;
}
