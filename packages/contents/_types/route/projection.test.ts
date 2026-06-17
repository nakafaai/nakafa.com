import { ContentIO } from "@repo/contents/_lib/io/content";
import { defineAssessment } from "@repo/contents/_types/assessment/schema";
import { ProjectedCurriculumNodeSchema } from "@repo/contents/_types/curriculum/projection";
import { defineCurriculum } from "@repo/contents/_types/curriculum/schema";
import { MATERIAL_ROUTE_DOMAINS } from "@repo/contents/_types/material/domain";
import { definePracticeMaterial } from "@repo/contents/_types/material/schema";
import { MATERIAL_SOURCES } from "@repo/contents/_types/material/source";
import {
  findPublicContentRouteByPathEffect,
  findPublicContentRouteBySourcePathEffect,
  findPublicRouteByPathEffect,
  getPublicRouteNamespaceEffect,
  listPublicAssessmentRoutesEffect,
  listPublicContentRoutesEffect,
  listPublicCurriculumRoutesEffect,
  listPublicRoutesEffect,
  toPublicExerciseQuestionPathEffect,
} from "@repo/contents/_types/route/projection";
import {
  PublicRoutePathSchema,
  PublicRouteSegmentSchema,
} from "@repo/contents/_types/route/segment";
import { Effect, Either, Exit, Option, Schema } from "effect";
import { describe, expect, it } from "vitest";

describe("public route projection", () => {
  it("decodes branded public segments and namespaces at the route boundary", () => {
    expect(Effect.runSync(getPublicRouteNamespaceEffect("subject", "id"))).toBe(
      "materi"
    );
    expect(Effect.runSync(listPublicRoutesEffect()).length).toBeGreaterThan(0);

    const invalidSegment = Schema.decodeUnknownEither(PublicRouteSegmentSchema)(
      "Not A Segment"
    );
    const invalidPath = Schema.decodeUnknownEither(PublicRoutePathSchema)(
      "materi//matematika"
    );

    expect(Either.isLeft(invalidSegment)).toBe(true);
    expect(Either.isLeft(invalidPath)).toBe(true);
    if (Either.isLeft(invalidSegment)) {
      expect(String(invalidSegment.left)).toContain(
        "Invalid public route segment."
      );
    }
    if (Either.isLeft(invalidPath)) {
      expect(String(invalidPath.left)).toContain("Invalid public route path.");
    }
  });

  it("derives canonical subject routes from unified material sources", () => {
    const routes = Effect.runSync(listPublicContentRoutesEffect());

    expect(routes).toContainEqual(
      expect.objectContaining({
        kind: "subject-topic",
        locale: "id",
        materialKey: "lesson.mathematics.integral",
        publicPath: "materi/matematika/integral",
        sourcePath: "material/lesson/mathematics/integral",
      })
    );
    expect(routes).toContainEqual(
      expect.objectContaining({
        kind: "subject-lesson",
        locale: "id",
        materialKey: "lesson.mathematics.integral",
        publicPath: "materi/matematika/integral/jumlahan-riemann",
        sourcePath: "material/lesson/mathematics/integral/riemann-sum",
      })
    );
    expect(routes).toContainEqual(
      expect.objectContaining({
        kind: "subject-lesson",
        locale: "en",
        publicPath: "subjects/mathematics/integral/riemann-sum",
      })
    );
  });

  it("derives Merdeka context routes from curriculum mappings, not grade folders", () => {
    const routes = Effect.runSync(listPublicCurriculumRoutesEffect());

    expect(routes).toContainEqual(
      expect.objectContaining({
        canonicalPath: "materi/matematika/integral",
        kind: "curriculum-context",
        locale: "id",
        materialDomain: "mathematics",
        materialKey: "lesson.mathematics.integral",
        programKey: "id-kurikulum-merdeka",
        publicPath: "kurikulum/merdeka/kelas-12/matematika/integral",
      })
    );
    expect(routes).toContainEqual(
      expect.objectContaining({
        canonicalPath: "subjects/mathematics/integral",
        kind: "curriculum-context",
        locale: "en",
        materialKey: "lesson.mathematics.integral",
        programKey: "id-kurikulum-merdeka",
        publicPath: "curriculum/merdeka/class-12/mathematics/integral",
      })
    );
    expect(
      routes.every((route) => !route.publicPath.includes("high-school"))
    ).toBe(true);
    expect(routes).toContainEqual(
      expect.objectContaining({
        kind: "curriculum-context",
        locale: "id",
        materialDomain: "physics",
        nodeKey: "class-10-physics",
        publicPath: "kurikulum/merdeka/kelas-10/fisika",
      })
    );
  });

  it("projects curriculum nodes from their own route slug when a parent is absent", () => {
    const curriculum = defineCurriculum({
      programKey: "id-kurikulum-merdeka",
      tree: [
        {
          children: [
            {
              key: "child",
              level: "topic",
              materialKeys: ["lesson.mathematics.integral"],
              order: 1,
            },
          ],
          key: "parent",
          level: "subject",
          order: 1,
          translations: {
            en: { routeSlug: "parent", title: "Parent" },
            id: { routeSlug: "induk", title: "Induk" },
          },
        },
      ],
    });
    const orphanNode = Schema.decodeUnknownSync(ProjectedCurriculumNodeSchema)({
      curriculumKey: "id-kurikulum-merdeka",
      key: "child",
      level: "topic",
      materialKeys: ["lesson.mathematics.integral"],
      order: 1,
      parentKey: "missing-parent",
      translations: {
        en: { routeSlug: "child", title: "Child" },
        id: { routeSlug: "anak", title: "Anak" },
      },
    });
    const routes = Effect.runSync(
      listPublicCurriculumRoutesEffect({
        curricula: [curriculum],
        curriculumNodes: [orphanNode],
      })
    );

    expect(routes).toContainEqual(
      expect.objectContaining({
        nodeKey: "child",
        publicPath: "kurikulum/merdeka/integral",
      })
    );
  });

  it("projects descendant curriculum material even when children are decoded first", () => {
    const curriculum = defineCurriculum({
      programKey: "id-kurikulum-merdeka",
      tree: [],
    });
    const childNode = Schema.decodeUnknownSync(ProjectedCurriculumNodeSchema)({
      curriculumKey: "id-kurikulum-merdeka",
      key: "child-first",
      level: "topic",
      materialKeys: ["lesson.mathematics.integral"],
      order: 1,
      parentKey: "parent-second",
      translations: {
        en: { routeSlug: "child-first", title: "Child first" },
        id: { routeSlug: "anak-dulu", title: "Anak dulu" },
      },
    });
    const parentNode = Schema.decodeUnknownSync(ProjectedCurriculumNodeSchema)({
      curriculumKey: "id-kurikulum-merdeka",
      key: "parent-second",
      level: "subject",
      materialKeys: [],
      order: 1,
      translations: {
        en: { routeSlug: "parent-second", title: "Parent second" },
        id: { routeSlug: "induk-kedua", title: "Induk kedua" },
      },
    });
    const routes = Effect.runSync(
      listPublicCurriculumRoutesEffect({
        curricula: [curriculum],
        curriculumNodes: [childNode, parentNode],
      })
    );

    expect(routes).toContainEqual(
      expect.objectContaining({
        nodeKey: "parent-second",
        publicPath: "kurikulum/merdeka/induk-kedua",
      })
    );
  });

  it("derives Cambridge context routes from course and unit nodes", () => {
    expect(Effect.runSync(listPublicCurriculumRoutesEffect())).toContainEqual(
      expect.objectContaining({
        canonicalPath: "subjects/mathematics/linear-equation-inequality",
        kind: "curriculum-context",
        locale: "en",
        materialDomain: "mathematics",
        materialKey: "lesson.mathematics.linear-equation-inequality",
        programKey: "cambridge-igcse",
        publicPath:
          "curriculum/cambridge-igcse/mathematics-0580/algebra-and-graphs/linear-equation-inequality",
      })
    );
    expect(Effect.runSync(listPublicCurriculumRoutesEffect())).toContainEqual(
      expect.objectContaining({
        canonicalPath:
          "materi/matematika/sistem-persamaan-dan-pertidaksamaan-linear",
        kind: "curriculum-context",
        locale: "id",
        materialKey: "lesson.mathematics.linear-equation-inequality",
        programKey: "cambridge-igcse",
        publicPath:
          "kurikulum/cambridge-igcse/mathematics-0580/aljabar-dan-grafik/sistem-persamaan-dan-pertidaksamaan-linear",
      })
    );
  });

  it("does not invent public routes for planned curricula without material mappings", () => {
    expect(
      Effect.runSync(listPublicCurriculumRoutesEffect()).some(
        (route) => route.programKey === "us-common-core-ngss"
      )
    ).toBe(false);
  });

  it("fails with a typed error when curriculum mapping references unknown material", () => {
    const invalidCurriculum = defineCurriculum({
      programKey: "id-kurikulum-merdeka",
      tree: [
        {
          key: "missing-material",
          level: "topic",
          materialKeys: ["lesson.fixture.missing"],
          order: 1,
        },
      ],
    });
    const exit = Effect.runSyncExit(
      listPublicCurriculumRoutesEffect({
        curricula: [invalidCurriculum],
        materials: [],
      })
    );

    expect(Exit.isFailure(exit)).toBe(true);
  });

  it("derives assessment context and canonical exercise routes", () => {
    expect(Effect.runSync(listPublicAssessmentRoutesEffect())).toContainEqual(
      expect.objectContaining({
        canonicalPath: "latihan/snbt/pengetahuan-kuantitatif/tryout/2026",
        kind: "assessment-context",
        locale: "id",
        materialKey: "practice.assessment.snbt.quantitative-knowledge",
        programKey: "snbt-2026",
        publicPath: "ujian/snbt/pengetahuan-kuantitatif/tryout/2026",
      })
    );
    expect(Effect.runSync(listPublicAssessmentRoutesEffect())).toContainEqual(
      expect.objectContaining({
        canonicalPath: "practice/snbt/quantitative-knowledge/mock-test/2026",
        kind: "assessment-context",
        locale: "en",
        materialKey: "practice.assessment.snbt.quantitative-knowledge",
        programKey: "snbt-2026",
        publicPath: "exams/snbt/quantitative-knowledge/mock-test/2026",
      })
    );
    expect(Effect.runSync(listPublicContentRoutesEffect())).toContainEqual(
      expect.objectContaining({
        kind: "exercise-set",
        locale: "id",
        publicPath: "latihan/snbt/pengetahuan-kuantitatif/tryout/2026/set-1",
        sourcePath:
          "material/practice/assessment/snbt/quantitative-knowledge/try-out-2026/set-1",
      })
    );
    expect(
      Effect.runSync(
        toPublicExerciseQuestionPathEffect({
          assessment: "snbt",
          domain: "quantitative-knowledge",
          exerciseType: "try-out",
          locale: "id",
          number: 9,
          setName: "set-1",
          year: 2026,
        })
      )
    ).toBe("latihan/snbt/pengetahuan-kuantitatif/tryout/2026/set-1/soal-9");
    expect(
      Effect.runSync(
        toPublicExerciseQuestionPathEffect({
          assessment: "snbt",
          domain: "quantitative-knowledge",
          exerciseType: "try-out",
          locale: "en",
          number: 9,
          setName: "set-1",
          year: 2026,
        })
      )
    ).toBe(
      "practice/snbt/quantitative-knowledge/mock-test/2026/set-1/question-9"
    );
    expect(
      Option.getOrNull(
        Effect.runSync(
          findPublicRouteByPathEffect(
            "practice/snbt/quantitative-knowledge/mock-test/2026/set-1/question-9",
            "en"
          )
        )
      )
    ).toMatchObject({
      kind: "exercise-question",
      publicPath:
        "practice/snbt/quantitative-knowledge/mock-test/2026/set-1/question-9",
      sourcePath:
        "material/practice/assessment/snbt/quantitative-knowledge/try-out-2026/set-1/question-9",
    });
    expect(
      Option.getOrNull(
        Effect.runSync(
          findPublicRouteByPathEffect(
            "latihan/snbt/pengetahuan-kuantitatif/tryout/2026/set-1/soal-9",
            "id"
          )
        )
      )
    ).toMatchObject({
      kind: "exercise-question",
      publicPath:
        "latihan/snbt/pengetahuan-kuantitatif/tryout/2026/set-1/soal-9",
    });
  });

  it("derives question routes from source paths and supports no-year practice groups", () => {
    expect(
      Option.getOrNull(
        Effect.runSync(
          findPublicRouteByPathEffect(
            "materi/matematika/integral/jumlahan-riemann",
            "id"
          )
        )
      )
    ).toMatchObject({
      kind: "subject-lesson",
      sourcePath: "material/lesson/mathematics/integral/riemann-sum",
    });
    expect(
      Option.getOrNull(
        Effect.runSync(
          findPublicContentRouteByPathEffect(
            "materi/matematika/integral/jumlahan-riemann",
            "id"
          )
        )
      )
    ).toMatchObject({
      kind: "subject-lesson",
      sourcePath: "material/lesson/mathematics/integral/riemann-sum",
    });
    expect(
      Option.getOrNull(
        Effect.runSync(
          findPublicContentRouteByPathEffect(
            "latihan/snbt/pengetahuan-kuantitatif/tryout/2026/set-1/soal-9",
            "id"
          )
        )
      )
    ).toMatchObject({
      kind: "exercise-question",
      sourcePath:
        "material/practice/assessment/snbt/quantitative-knowledge/try-out-2026/set-1/question-9",
    });
    expect(
      Option.isNone(
        Effect.runSync(
          findPublicContentRouteByPathEffect(
            "latihan/snbt/pengetahuan-kuantitatif/tryout/2026",
            "id"
          )
        )
      )
    ).toBe(true);
    expect(
      Option.getOrNull(
        Effect.runSync(
          findPublicContentRouteBySourcePathEffect(
            "material/lesson/mathematics/integral/riemann-sum",
            "id"
          )
        )
      )
    ).toMatchObject({
      kind: "subject-lesson",
      publicPath: "materi/matematika/integral/jumlahan-riemann",
    });

    const sourceRoute = Effect.runSync(
      findPublicContentRouteBySourcePathEffect(
        "material/practice/assessment/snbt/quantitative-knowledge/try-out-2026/set-1/question-9",
        "id"
      )
    );

    expect(Option.getOrNull(sourceRoute)).toMatchObject({
      publicPath:
        "latihan/snbt/pengetahuan-kuantitatif/tryout/2026/set-1/soal-9",
      sourcePath:
        "material/practice/assessment/snbt/quantitative-knowledge/try-out-2026/set-1/question-9",
    });
    expect(
      Option.getOrNull(
        Effect.runSync(
          findPublicContentRouteBySourcePathEffect(
            "material/practice/assessment/snbt/quantitative-knowledge/try-out-2026/set-1/question-9",
            "en"
          )
        )
      )
    ).toMatchObject({
      publicPath:
        "practice/snbt/quantitative-knowledge/mock-test/2026/set-1/question-9",
      sourcePath:
        "material/practice/assessment/snbt/quantitative-knowledge/try-out-2026/set-1/question-9",
    });
    expect(
      Option.isNone(
        Effect.runSync(
          findPublicRouteByPathEffect(
            "latihan/snbt/pengetahuan-kuantitatif/review/2026/set-1/soal-1",
            "id"
          )
        )
      )
    ).toBe(true);
    expect(
      Option.isNone(
        Effect.runSync(
          findPublicRouteByPathEffect(
            "latihan/snbt/pengetahuan-kuantitatif/tryout/2026/set-1/question-1",
            "id"
          )
        )
      )
    ).toBe(true);
    expect(
      Option.isNone(
        Effect.runSync(
          findPublicRouteByPathEffect(
            "latihan/snbt/pengetahuan-kuantitatif/tryout/2026/set-1/soal-0",
            "id"
          )
        )
      )
    ).toBe(true);
    expect(
      Option.isNone(
        Effect.runSync(
          findPublicContentRouteBySourcePathEffect(
            "material/practice/assessment/snbt/quantitative-knowledge/try-out-2026/set-1/question-0",
            "en"
          )
        )
      )
    ).toBe(true);

    const practiceWithoutYear = definePracticeMaterial({
      assessment: "snbt",
      assetRoot: "material/practice/assessment/snbt/mathematics/drill",
      domain: "mathematics",
      groups: [
        {
          exerciseType: "drill",
          routeSlugs: { en: "drill", id: "latihan" },
          sets: [
            {
              routeSlugs: { en: "set-a", id: "set-a" },
              slug: "set-a",
              translations: {
                en: { title: "Set A" },
                id: { title: "Set A" },
              },
            },
          ],
          translations: {
            en: { description: "Focused drill.", title: "Drill" },
            id: { description: "Latihan fokus.", title: "Latihan" },
          },
        },
      ],
      key: "practice.fixture.snbt.no-year",
      kind: "practice",
    });

    expect(
      Effect.runSync(
        toPublicExerciseQuestionPathEffect({
          assessment: "snbt",
          domain: "mathematics",
          exerciseType: "drill",
          locale: "id",
          materials: [practiceWithoutYear],
          number: 2,
          setName: "set-a",
        })
      )
    ).toBe("latihan/snbt/matematika/latihan/set-a/soal-2");
    expect(
      Option.isNone(
        Effect.runSync(
          findPublicContentRouteBySourcePathEffect(
            "material/practice/assessment/snbt/mathematics/drill/set-a/question-0",
            "en",
            { materials: [practiceWithoutYear] }
          )
        )
      )
    ).toBe(true);
    expect(
      Option.isNone(
        Effect.runSync(
          findPublicContentRouteBySourcePathEffect(
            "material/practice/assessment/snbt/mathematics/other/set-a/question-1",
            "en",
            { materials: [practiceWithoutYear] }
          )
        )
      )
    ).toBe(true);
  });

  it("fails with typed errors for invalid or incomplete practice route input", () => {
    const invalidInput = JSON.parse(
      JSON.stringify({
        assessment: "snbt",
        domain: "quantitative-knowledge",
        exerciseType: "try-out",
        locale: "fr",
        number: 1,
        setName: "set-1",
        year: 2026,
      })
    );
    const missingMaterial = toPublicExerciseQuestionPathEffect({
      assessment: "snbt",
      domain: "quantitative-knowledge",
      exerciseType: "try-out",
      locale: "id",
      materials: [],
      number: 1,
      setName: "set-1",
      year: 2026,
    });
    const missingActivity = toPublicExerciseQuestionPathEffect({
      assessment: "snbt",
      domain: "quantitative-knowledge",
      exerciseType: "drill",
      locale: "id",
      number: 1,
      setName: "set-1",
      year: 2026,
    });
    const missingDomain = toPublicExerciseQuestionPathEffect({
      assessment: "snbt",
      domain: "quantitative-knowledge",
      domains: [],
      exerciseType: "try-out",
      locale: "id",
      number: 1,
      setName: "set-1",
      year: 2026,
    });

    expect(
      Exit.isFailure(
        Effect.runSyncExit(toPublicExerciseQuestionPathEffect(invalidInput))
      )
    ).toBe(true);
    expect(Exit.isFailure(Effect.runSyncExit(missingMaterial))).toBe(true);
    expect(Exit.isFailure(Effect.runSyncExit(missingActivity))).toBe(true);
    expect(Exit.isFailure(Effect.runSyncExit(missingDomain))).toBe(true);
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
      listPublicAssessmentRoutesEffect({
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
      listPublicAssessmentRoutesEffect({
        assessments: [assessment],
      })
    );

    expect(routes).toContainEqual(
      expect.objectContaining({
        materialKey: undefined,
        nodeKey: "parent-domain",
        publicPath: "ujian/snbt/domain-induk",
      })
    );
    expect(routes).toContainEqual(
      expect.objectContaining({
        canonicalPath: "latihan/snbt/pengetahuan-kuantitatif/tryout/2026",
        materialKey: "practice.assessment.snbt.quantitative-knowledge",
        nodeKey: "child-practice",
      })
    );
  });

  it("fails with typed errors when program or namespace source rows are missing", () => {
    const assessment = defineAssessment({
      nodes: [],
      programKey: "snbt-2026",
    });
    const missingProgram = Effect.runSyncExit(
      listPublicAssessmentRoutesEffect({
        assessments: [assessment],
        programs: [],
      })
    );
    const missingNamespace = Effect.runSyncExit(
      getPublicRouteNamespaceEffect(JSON.parse('"missing-surface"'), "en")
    );

    expect(Exit.isFailure(missingProgram)).toBe(true);
    expect(Exit.isFailure(missingNamespace)).toBe(true);
  });

  it("keeps internal material source paths out of public routes", () => {
    expect(
      Option.isNone(
        Effect.runSync(
          findPublicRouteByPathEffect(
            "material/lesson/mathematics/integral/riemann-sum",
            "id"
          )
        )
      )
    ).toBe(true);
    expect(
      Option.isNone(
        Effect.runSync(
          findPublicRouteByPathEffect(
            "subject/matematika/integral/jumlahan-riemann",
            "id"
          )
        )
      )
    ).toBe(true);
    expect(
      Option.isNone(
        Effect.runSync(
          findPublicRouteByPathEffect(
            "assessment/snbt-2026/pengetahuan-kuantitatif/tryout-2026",
            "id"
          )
        )
      )
    ).toBe(true);
  });

  it("fails with a typed error when route source slugs are missing", () => {
    const exit = Effect.runSyncExit(
      listPublicContentRoutesEffect({
        domains: MATERIAL_ROUTE_DOMAINS.filter(
          (domain) =>
            !(domain.kind === "lesson" && domain.domain === "mathematics")
        ),
      })
    );

    expect(Exit.isFailure(exit)).toBe(true);
  });

  it("fails with a typed error when two generated routes collide", () => {
    const firstLesson = MATERIAL_SOURCES.find(
      (material) => material.kind === "lesson"
    );

    if (!firstLesson) {
      expect(firstLesson).toBeDefined();
      return;
    }

    const exit = Effect.runSyncExit(
      listPublicContentRoutesEffect({
        materials: [firstLesson, firstLesson],
      })
    );

    expect(Exit.isFailure(exit)).toBe(true);
  });

  it("keeps dynamic slugs outside the route projection implementation", async () => {
    const source = await Effect.runPromise(
      ContentIO.readFileString(
        new URL("projection.ts", import.meta.url).pathname
      ).pipe(Effect.provide(ContentIO.Default))
    );
    const forbiddenTokens = [
      ["domain", "Slugs"].join(""),
      ["program", "Slugs"].join(""),
      ["??", "toPublicSlug"].join(" "),
      ["tryout", "2026"].join("-"),
    ];

    for (const token of forbiddenTokens) {
      expect(source).not.toContain(token);
    }
  });
});
