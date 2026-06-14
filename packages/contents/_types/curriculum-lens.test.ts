import {
  type CurriculumLensDescriptor,
  createCurriculumLensDescriptor,
} from "@repo/contents/_types/curriculum-lens";
import { getCurriculumLensScopeForKind } from "@repo/contents/_types/graph/schema";
import type { LearningGraphSource } from "@repo/contents/_types/learning-graph";
import { describe, expect, it } from "vitest";

describe("curriculum lens", () => {
  it("groups subject topics and sections under the same curriculum lens", () => {
    const topic = readCurriculumLensFixture({
      kind: "subject-topic",
      locale: "id",
      route: "subject/high-school/10/chemistry/atomic-structure",
    });
    const section = readCurriculumLensFixture({
      kind: "subject-section",
      locale: "en",
      route:
        "subject/high-school/10/chemistry/atomic-structure/electron-configuration",
    });

    expect(topic).toMatchObject({
      lensId: "lens:subject:high-school:10:chemistry",
      scope: "curriculum",
      segments: ["subject", "high-school", "10", "chemistry"],
    });
    expect(section.lensId).toBe(topic.lensId);
  });

  it("keeps exam questions aligned to their exam lens", () => {
    const group = readCurriculumLensFixture({
      kind: "exercise-group",
      locale: "id",
      route: "exercises/high-school/snbt/quantitative-knowledge/try-out/2026",
    });
    const question = readCurriculumLensFixture({
      kind: "exercise-question",
      locale: "en",
      route:
        "exercises/high-school/snbt/quantitative-knowledge/try-out/2026/set-1/7",
    });

    expect(group).toMatchObject({
      lensId: "lens:exercise:high-school:snbt:quantitative-knowledge",
      scope: getCurriculumLensScopeForKind("exercise-question"),
    });
    expect(question.lensId).toBe(group.lensId);
  });

  it("keeps non-curriculum source families explicit", () => {
    expect(
      readCurriculumLensFixture({
        kind: "article",
        locale: "id",
        route: "articles/politics/democracy",
      }).scope
    ).toBe("article-domain");
    expect(
      readCurriculumLensFixture({
        kind: "quran-surah",
        locale: "id",
        route: "quran/1",
      }).scope
    ).toBe("scripture");
  });

  it("returns null when the declared kind does not match the route projection", () => {
    expect(
      createCurriculumLensDescriptor({
        kind: "subject-section",
        locale: "id",
        route: "subject/high-school/10/chemistry/atomic-structure",
      })
    ).toBeNull();
  });
});

function readCurriculumLensFixture(
  source: LearningGraphSource
): CurriculumLensDescriptor {
  const descriptor = createCurriculumLensDescriptor(source);

  if (!descriptor) {
    throw new Error(`Expected curriculum lens fixture for ${source.route}.`);
  }

  return descriptor;
}
