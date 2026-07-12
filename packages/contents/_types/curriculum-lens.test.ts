import {
  type CurriculumLensDescriptor,
  createCurriculumLensDescriptor,
} from "@repo/contents/_types/curriculum-lens";
import { getCurriculumLensScopeForKind } from "@repo/contents/_types/graph/schema";
import type { LearningGraphSource } from "@repo/contents/_types/learning-graph";
import { describe, expect, it } from "vitest";

describe("curriculum lens", () => {
  it("groups curriculum topics and sections under the same curriculum lens", () => {
    const topic = readCurriculumLensFixture({
      kind: "curriculum-topic",
      locale: "id",
      route: "material/lesson/chemistry/atomic-structure",
    });
    const section = readCurriculumLensFixture({
      kind: "curriculum-lesson",
      locale: "en",
      route:
        "material/lesson/chemistry/atomic-structure/electron-configuration",
    });

    expect(topic).toMatchObject({
      lensId: "lens:material:lesson:chemistry",
      scope: "curriculum",
      segments: ["material", "lesson", "chemistry"],
    });
    expect(section.lensId).toBe(topic.lensId);
  });

  it("keeps try-out sections aligned to their exam lens", () => {
    const exam = readCurriculumLensFixture({
      kind: "tryout-exam",
      locale: "id",
      route: "try-out/indonesia/snbt",
    });
    const section = readCurriculumLensFixture({
      kind: "tryout-section",
      locale: "en",
      route: "try-out/indonesia/snbt/2027/set-1/quantitative-knowledge",
    });

    expect(exam).toMatchObject({
      lensId: "lens:tryout:indonesia:snbt",
      scope: getCurriculumLensScopeForKind("tryout-section"),
    });
    expect(section.lensId).toBe(exam.lensId);
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
        kind: "curriculum-lesson",
        locale: "id",
        route: "material/lesson/chemistry/atomic-structure",
      })
    ).toBeNull();
  });
});

/** Decode one curriculum-lens fixture from a learning graph source. */
function readCurriculumLensFixture(
  source: LearningGraphSource
): CurriculumLensDescriptor {
  const descriptor = createCurriculumLensDescriptor(source);

  if (!descriptor) {
    throw new Error(`Expected curriculum lens fixture for ${source.route}.`);
  }

  return descriptor;
}
