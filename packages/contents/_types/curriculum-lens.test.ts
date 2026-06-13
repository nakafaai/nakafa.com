import { createCurriculumLensDescriptor } from "@repo/contents/_types/curriculum-lens";
import { describe, expect, it } from "vitest";

describe("curriculum lens", () => {
  it("groups subject topics and sections under the same curriculum lens", () => {
    const topic = createCurriculumLensDescriptor({
      kind: "subject-topic",
      locale: "id",
      route: "subject/high-school/10/chemistry/atomic-structure",
    });
    const section = createCurriculumLensDescriptor({
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
    const group = createCurriculumLensDescriptor({
      kind: "exercise-group",
      locale: "id",
      route: "exercises/high-school/snbt/quantitative-knowledge/try-out/2026",
    });
    const question = createCurriculumLensDescriptor({
      kind: "exercise-question",
      locale: "en",
      route:
        "exercises/high-school/snbt/quantitative-knowledge/try-out/2026/set-1/7",
    });

    expect(group).toMatchObject({
      lensId: "lens:exercise:high-school:snbt:quantitative-knowledge",
      scope: "exam",
    });
    expect(question.lensId).toBe(group.lensId);
  });

  it("keeps non-curriculum source families explicit", () => {
    expect(
      createCurriculumLensDescriptor({
        kind: "article",
        locale: "id",
        route: "articles/politics/democracy",
      }).scope
    ).toBe("article-domain");
    expect(
      createCurriculumLensDescriptor({
        kind: "quran-surah",
        locale: "id",
        route: "quran/1",
      }).scope
    ).toBe("scripture");
  });
});
