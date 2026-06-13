import {
  createLearningGraphIdentity,
  normalizeGraphRoute,
} from "@repo/contents/_types/learning-graph";
import { describe, expect, it } from "vitest";

describe("learning graph identity", () => {
  it("maps article sources into locale asset identity and route-free graph IDs", () => {
    const identity = createLearningGraphIdentity({
      kind: "article",
      locale: "id",
      route: "/articles/politics/makna-demokrasi",
    });

    expect(identity).toEqual({
      alignmentId:
        "alignment:article:politics:article:politics:makna-demokrasi",
      assetId: "asset:id:article:politics:makna-demokrasi",
      conceptId: "concept:article:politics",
      learningObjectId: "lo:article:politics:makna-demokrasi",
      lensId: "lens:article:politics",
    });
  });

  it("separates subject concepts from curriculum lenses", () => {
    const topic = createLearningGraphIdentity({
      kind: "subject-topic",
      locale: "id",
      route: "subject/high-school/10/chemistry/atomic-structure",
    });
    const section = createLearningGraphIdentity({
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

  it("keeps exam alignment separate from concrete exercise objects", () => {
    const group = createLearningGraphIdentity({
      kind: "exercise-group",
      locale: "en",
      route:
        "exercises/high-school/snbt/quantitative-knowledge/try-out/2026",
    });
    const set = createLearningGraphIdentity({
      kind: "exercise-set",
      locale: "en",
      route:
        "exercises/high-school/snbt/quantitative-knowledge/try-out/2026/set-1",
    });
    const question = createLearningGraphIdentity({
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
      "asset:en:exercise-question:snbt:quantitative-knowledge:try-out:2026:set-1:7"
    );
  });

  it("supports non-route Quran graph identity", () => {
    expect(
      createLearningGraphIdentity({
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
});
