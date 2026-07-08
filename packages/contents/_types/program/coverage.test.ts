import { LEARNING_PROGRAM_CATALOG } from "@repo/contents/_types/program/catalog";
import {
  createCurriculumCoverageInputs,
  createFallbackCoverageInputs,
  createLearningProgramCoverageInputs,
  getProgramKeysForCoverageRoute,
  projectLearningProgramCoverageInputs,
} from "@repo/contents/_types/program/coverage";
import {
  LearningProgramCoverageRouteSchema,
  LearningProgramKeySchema,
} from "@repo/contents/_types/program/schema";
import { Effect, Schema } from "effect";
import { describe, expect, it } from "vitest";

const decodeRoute = Schema.decodeUnknownSync(
  LearningProgramCoverageRouteSchema
);

const subjectRoute = decodeRoute({
  assetId:
    "asset:id:material:lesson:mathematics:material-topic:mathematics:exponential-logarithm",
  conceptId: "concept:material:lesson:mathematics:exponential-logarithm",
  kind: "curriculum-topic",
  lensId: "lens:material:lesson:mathematics",
  locale: "id",
  route: "materi/matematika/eksponen-logaritma",
  sourcePath: "material/lesson/mathematics/exponential-logarithm",
});

const snbtRoute = decodeRoute({
  assetId: "asset:id:tryout:indonesia:snbt:tryout-set:indonesia:snbt:set-1",
  conceptId: "concept:tryout:indonesia:snbt:set-1",
  kind: "tryout-set",
  lensId: "lens:tryout:indonesia:snbt",
  locale: "id",
  route: "try-out/indonesia/snbt/set-1",
  sourcePath: "try-out/indonesia/snbt/set-1",
});

const englishSubjectRoute = decodeRoute({
  ...subjectRoute,
  assetId:
    "asset:en:material:lesson:mathematics:material-topic:mathematics:exponential-logarithm",
  locale: "en",
  route: "subjects/mathematics/exponential-logarithm",
});

describe("program/coverage", () => {
  it("keeps assessment route rules separate from curriculum mappings", () => {
    expect(getProgramKeysForCoverageRoute(subjectRoute)).toEqual([]);
    expect(getProgramKeysForCoverageRoute(snbtRoute)).toEqual(["snbt"]);
  });

  it("maps curriculum topics through curriculum-owned material references", () => {
    const mappedTopicRoute = decodeRoute({
      assetId:
        "asset:id:material:lesson:biology:material-topic:biology:biodiversity",
      conceptId: "concept:material:lesson:biology:biodiversity",
      kind: "curriculum-topic",
      lensId: "lens:material:lesson:biology",
      locale: "id",
      route: "materi/biologi/keanekaragaman-makhluk-hidup",
      sourcePath: "material/lesson/biology/biodiversity",
    });

    const programKeys = createCurriculumCoverageInputs({
      programs: LEARNING_PROGRAM_CATALOG,
      routes: [mappedTopicRoute],
      syncedAt: 1,
    })
      .map((row) => row.programKey)
      .sort();

    expect(programKeys).toEqual([
      "cambridge-international",
      "merdeka",
      "singapore-moe",
      "united-states",
    ]);
  });

  it("falls back only through explicit fallback alignment rules", () => {
    const unmatchedRoute = decodeRoute({
      assetId: "asset:id:article:learning:general",
      conceptId: "concept:article:learning",
      kind: "tryout-set",
      lensId: "lens:article:general",
      locale: "id",
      route: "articles/learning/general",
      sourcePath: "articles/learning/general",
    });

    expect(
      getProgramKeysForCoverageRoute(unmatchedRoute, [
        {
          match: { fallback: true },
          programKey: LearningProgramKeySchema.make("fixture-program"),
        },
      ])
    ).toEqual(["fixture-program"]);
    expect(
      getProgramKeysForCoverageRoute(unmatchedRoute, [
        {
          match: { routeKinds: ["curriculum-topic"] },
          programKey: LearningProgramKeySchema.make("merdeka"),
        },
      ])
    ).toEqual([]);
    expect(
      getProgramKeysForCoverageRoute(snbtRoute, [
        {
          match: { routeKinds: ["tryout-set"] },
          programKey: LearningProgramKeySchema.make("fixture-program"),
        },
      ])
    ).toEqual(["fixture-program"]);
    expect(
      getProgramKeysForCoverageRoute(snbtRoute, [
        {
          match: { lensSegments: ["tka"] },
          programKey: LearningProgramKeySchema.make("tka"),
        },
      ])
    ).toEqual([]);
    expect(
      getProgramKeysForCoverageRoute(snbtRoute, [
        {
          match: { lensSegments: ["snbt"], routeSegments: ["missing"] },
          programKey: LearningProgramKeySchema.make("snbt"),
        },
      ])
    ).toEqual([]);
  });

  it("projects graph routes to program coverage without persisting route identity", () => {
    const rows = createLearningProgramCoverageInputs({
      programs: LEARNING_PROGRAM_CATALOG,
      routes: [subjectRoute, snbtRoute],
      syncedAt: 1,
    });
    const rowsByProgram = Object.fromEntries(
      rows.map((row) => [row.programKey, row])
    );

    expect(rowsByProgram.merdeka).toMatchObject({
      coverageStatus: "partial",
      lensScope: "curriculum",
    });
    expect(rowsByProgram.snbt).toMatchObject({ lensScope: "exam" });
    expect(JSON.stringify(rows)).not.toContain("material/practice");
  });

  it("projects program coverage through the Effect sync entrypoint", async () => {
    const rows = await Effect.runPromise(
      projectLearningProgramCoverageInputs({
        programs: LEARNING_PROGRAM_CATALOG,
        routes: [subjectRoute, snbtRoute],
        syncedAt: 1,
      })
    );
    const rowsByProgram = Object.fromEntries(
      rows.map((row) => [row.programKey, row])
    );

    expect(rowsByProgram.merdeka).toMatchObject({
      lensScope: "curriculum",
    });
    expect(rowsByProgram.snbt).toMatchObject({ lensScope: "exam" });
  });

  it("preserves explicit available catalog status for real program coverage", () => {
    const rows = createLearningProgramCoverageInputs({
      programs: LEARNING_PROGRAM_CATALOG.map((program) => {
        if (program.key !== "merdeka") {
          return program;
        }

        return {
          ...program,
          defaultCoverageStatus: "available",
        };
      }),
      routes: [subjectRoute],
      syncedAt: 1,
    });

    const rowsByProgram = Object.fromEntries(
      rows.map((row) => [row.programKey, row])
    );

    expect(rowsByProgram.merdeka).toMatchObject({
      coverageStatus: "available",
      programKey: "merdeka",
    });
    expect(rowsByProgram["singapore-moe"]).toMatchObject({
      coverageStatus: "partial",
      programKey: "singapore-moe",
    });
    expect(rowsByProgram["united-states"]).toMatchObject({
      coverageStatus: "partial",
      programKey: "united-states",
    });
  });

  it("counts multiple materials under the same program language and lens", () => {
    const duplicateSubjectRoute = decodeRoute({
      ...subjectRoute,
      assetId:
        "asset:id:material:lesson:mathematics:material-topic:mathematics:second-topic",
      conceptId: "concept:material:lesson:mathematics:second-topic",
      route: "materi/matematika/topik-kedua",
      sourcePath: "material/lesson/mathematics/second-topic",
    });

    const rows = createFallbackCoverageInputs({
      alignments: [
        {
          match: { routeSegments: ["eksponen-logaritma"] },
          programKey: LearningProgramKeySchema.make("merdeka"),
        },
        {
          match: { routeSegments: ["topik-kedua"] },
          programKey: LearningProgramKeySchema.make("merdeka"),
        },
      ],
      programs: LEARNING_PROGRAM_CATALOG,
      routes: [subjectRoute, duplicateSubjectRoute],
      syncedAt: 1,
    });

    expect(rows).toEqual([
      expect.objectContaining({
        contentCount: 2,
        programKey: "merdeka",
        sampleContentId: subjectRoute.assetId,
      }),
    ]);
  });

  it("exposes curriculum and fallback projection seams", () => {
    const curriculumRows = createCurriculumCoverageInputs({
      programs: LEARNING_PROGRAM_CATALOG,
      routes: [subjectRoute],
      syncedAt: 1,
    });
    const fallbackRows = createFallbackCoverageInputs({
      programs: LEARNING_PROGRAM_CATALOG,
      routes: [subjectRoute],
      syncedAt: 1,
    });

    expect(curriculumRows.map((row) => row.programKey).sort()).toEqual([
      "merdeka",
      "singapore-moe",
      "united-states",
    ]);
    expect(fallbackRows).toEqual([]);
  });

  it("does not invent curriculum coverage for material outside a curriculum mapping", () => {
    const rows = createLearningProgramCoverageInputs({
      alignments: [],
      programs: LEARNING_PROGRAM_CATALOG,
      routes: [
        decodeRoute({
          assetId:
            "asset:id:material:lesson:ai-programming:material-topic:ai-programming:nlp",
          conceptId: "concept:material:lesson:ai-programming:nlp",
          kind: "curriculum-topic",
          lensId: "lens:material:lesson:ai-programming",
          locale: "id",
          route: "materi/ai-programming/nlp",
          sourcePath: "material/lesson/ai-programming/nlp",
        }),
      ],
      syncedAt: 1,
    });

    expect(rows).toEqual([]);
  });

  it("keeps program identity stable across content languages", () => {
    const rows = createLearningProgramCoverageInputs({
      programs: LEARNING_PROGRAM_CATALOG,
      routes: [subjectRoute, englishSubjectRoute],
      syncedAt: 1,
    });
    const rowsByProgramAndLocale = Object.fromEntries(
      rows.map((row) => [`${row.programKey}:${row.locale}`, row])
    );

    expect(rowsByProgramAndLocale["merdeka:id"]).toMatchObject({
      coverageStatus: "partial",
    });
    expect(rowsByProgramAndLocale["merdeka:en"]).toMatchObject({
      coverageStatus: "partial",
    });
  });

  it("keeps coverage statuses honest for duplicates and hidden catalog rows", () => {
    const duplicateSubjectRoute = decodeRoute({
      ...subjectRoute,
      assetId:
        "asset:id:material:lesson:mathematics:material-topic:mathematics:exponential-logarithm-practice",
      route: "materi/matematika/latihan-eksponen-logaritma",
      sourcePath: "material/lesson/mathematics/exponential-logarithm-practice",
    });
    const programs = LEARNING_PROGRAM_CATALOG.map((program) => {
      if (program.key !== "merdeka") {
        return program;
      }

      return { ...program, defaultCoverageStatus: "hidden" as const };
    });

    const rows = createLearningProgramCoverageInputs({
      programs,
      routes: [subjectRoute, duplicateSubjectRoute],
      syncedAt: 1,
    });
    const rowsByProgram = Object.fromEntries(
      rows.map((row) => [row.programKey, row])
    );

    expect(rowsByProgram.merdeka).toBeUndefined();
    expect(rowsByProgram["singapore-moe"]).toMatchObject({
      coverageStatus: "partial",
    });
    expect(rowsByProgram["united-states"]).toMatchObject({
      coverageStatus: "partial",
    });
  });

  it("projects archived and unknown programs without inventing availability", () => {
    const programs = LEARNING_PROGRAM_CATALOG.map((program) => {
      if (program.key !== "snbt") {
        return program;
      }

      return { ...program, defaultCoverageStatus: "archived" as const };
    });

    const rows = createLearningProgramCoverageInputs({
      alignments: [
        {
          match: { routeSegments: ["snbt"] },
          programKey: LearningProgramKeySchema.make("snbt"),
        },
        {
          match: { routeSegments: ["snbt"] },
          programKey: LearningProgramKeySchema.make("unknown-exam"),
        },
      ],
      programs,
      routes: [snbtRoute],
      syncedAt: 1,
    });
    const rowsByProgram = Object.fromEntries(
      rows.map((row) => [row.programKey, row])
    );

    expect(rowsByProgram.snbt).toMatchObject({
      coverageStatus: "archived",
    });
    expect(rowsByProgram["unknown-exam"]).toMatchObject({
      coverageStatus: "partial",
    });
  });
});
