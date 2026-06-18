import { defineAssessment } from "@repo/contents/_types/assessment/schema";
import { listPublicAssessmentRoutes } from "@repo/contents/_types/route/assessment";
import { getPublicRouteNamespace } from "@repo/contents/_types/route/path";
import { Effect, Exit } from "effect";
import { describe, expect, it } from "vitest";

describe("public assessment routes", () => {
  it("derives assessment context routes from assessment and practice sources", () => {
    const routes = Effect.runSync(listPublicAssessmentRoutes());

    expect(routes).toContainEqual(
      expect.objectContaining({
        canonicalPath: "latihan/snbt/pengetahuan-kuantitatif/tryout/2026",
        kind: "assessment-context",
        locale: "id",
        materialKey: "practice.assessment.snbt.quantitative-knowledge",
        order: 1,
        programKey: "snbt-2026",
        publicPath: "ujian/snbt/pengetahuan-kuantitatif/tryout/2026",
      })
    );
    expect(routes).toContainEqual(
      expect.objectContaining({
        canonicalPath: "practice/snbt/quantitative-knowledge/mock-test/2026",
        kind: "assessment-context",
        locale: "en",
        materialKey: "practice.assessment.snbt.quantitative-knowledge",
        order: 1,
        programKey: "snbt-2026",
        publicPath: "exams/snbt/quantitative-knowledge/mock-test/2026",
      })
    );
  });

  it("skips assessment nodes without material-backed public coverage", () => {
    const assessment = defineAssessment({
      nodes: [
        {
          key: "empty-domain",
          level: "domain",
          materialKeys: [],
          order: 1,
          translations: {
            en: { routeSlug: "empty-domain", title: "Empty domain" },
            id: { routeSlug: "domain-kosong", title: "Domain kosong" },
          },
        },
        {
          key: "missing-material-domain",
          level: "domain",
          materialKeys: ["practice.fixture.missing"],
          order: 2,
          translations: {
            en: {
              routeSlug: "missing-material-domain",
              title: "Missing material domain",
            },
            id: {
              routeSlug: "domain-materi-hilang",
              title: "Domain materi hilang",
            },
          },
        },
      ],
      programKey: "snbt-2026",
    });
    const routes = Effect.runSync(
      listPublicAssessmentRoutes({
        assessments: [assessment],
        materials: [],
      })
    );

    expect(
      routes.some((route) => route.publicPath.includes("empty-domain"))
    ).toBe(false);
    expect(
      routes.some((route) =>
        route.publicPath.includes("missing-material-domain")
      )
    ).toBe(true);
    expect(
      routes.some((route) => route.publicPath.includes("domain-kosong"))
    ).toBe(false);
  });

  it("keeps parent assessment nodes in context when descendants own material", () => {
    const assessment = defineAssessment({
      nodes: [
        {
          key: "parent-domain",
          level: "domain",
          materialKeys: [],
          order: 1,
          translations: {
            en: { routeSlug: "parent-domain", title: "Parent domain" },
            id: { routeSlug: "domain-induk", title: "Domain induk" },
          },
        },
        {
          key: "child-practice",
          level: "practice-set",
          materialKeys: ["practice.assessment.snbt.quantitative-knowledge"],
          order: 1,
          parentKey: "parent-domain",
          translations: {
            en: { routeSlug: "child-practice", title: "Child practice" },
            id: { routeSlug: "latihan-anak", title: "Latihan anak" },
          },
        },
      ],
      programKey: "snbt-2026",
    });
    const routes = Effect.runSync(
      listPublicAssessmentRoutes({
        assessments: [assessment],
      })
    );

    expect(routes).toContainEqual(
      expect.objectContaining({
        materialKey: undefined,
        nodeKey: "parent-domain",
        order: 1,
        publicPath: "ujian/snbt/domain-induk",
      })
    );
    expect(routes).toContainEqual(
      expect.objectContaining({
        canonicalPath: "latihan/snbt/pengetahuan-kuantitatif/tryout/2026",
        materialKey: "practice.assessment.snbt.quantitative-knowledge",
        nodeKey: "child-practice",
        order: 1,
      })
    );
  });

  it("fails with typed errors when program or namespace source rows are missing", () => {
    const assessment = defineAssessment({
      nodes: [],
      programKey: "snbt-2026",
    });
    const missingProgram = Effect.runSyncExit(
      listPublicAssessmentRoutes({
        assessments: [assessment],
        programs: [],
      })
    );
    const missingNamespace = Effect.runSyncExit(
      getPublicRouteNamespace(JSON.parse('"missing-surface"'), "en")
    );

    expect(Exit.isFailure(missingProgram)).toBe(true);
    expect(Exit.isFailure(missingNamespace)).toBe(true);
  });
});
