import { LEARNING_PROGRAM_CATALOG } from "@repo/contents/_types/program/catalog";
import { projectLearningProgramCoverageInputs } from "@repo/contents/_types/program/coverage";
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
  assetId:
    "asset:id:tryout:indonesia:snbt:tryout-set:indonesia:snbt:2027:set-1",
  conceptId: "concept:tryout:indonesia:snbt:2027:set-1",
  kind: "tryout-set",
  lensId: "lens:tryout:indonesia:snbt",
  locale: "id",
  route: "try-out/indonesia/snbt/2027/set-1",
  sourcePath: "try-out/indonesia/snbt/2027/set-1",
});

const englishSubjectRoute = decodeRoute({
  ...subjectRoute,
  assetId:
    "asset:en:material:lesson:mathematics:material-topic:mathematics:exponential-logarithm",
  locale: "en",
  route: "subjects/mathematics/exponential-logarithm",
});

describe("program/coverage", () => {
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

    const programKeys = projectCoverage({
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

  it("requires both route and lens alignment", () => {
    expect(
      projectCoverage({
        alignments: [
          {
            match: { lensSegments: ["snbt"], routeSegments: ["missing"] },
            programKey: LearningProgramKeySchema.make("snbt"),
          },
        ],
        curriculumNodes: [],
        programs: LEARNING_PROGRAM_CATALOG,
        routes: [snbtRoute],
        syncedAt: 1,
      })
    ).toEqual([]);
  });

  it("projects graph routes through the Effect sync entrypoint", () => {
    const rows = projectCoverage({
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

  it("preserves explicit available catalog status for real program coverage", () => {
    const rows = projectCoverage({
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

    const rows = projectCoverage({
      alignments: [
        {
          match: {
            lensSegments: ["mathematics"],
            routeSegments: ["eksponen-logaritma"],
          },
          programKey: LearningProgramKeySchema.make("merdeka"),
        },
        {
          match: {
            lensSegments: ["mathematics"],
            routeSegments: ["topik-kedua"],
          },
          programKey: LearningProgramKeySchema.make("merdeka"),
        },
      ],
      curriculumNodes: [],
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

  it("does not invent curriculum coverage for material outside a curriculum mapping", () => {
    const rows = projectCoverage({
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
    const rows = projectCoverage({
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

    const rows = projectCoverage({
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

    const rows = projectCoverage({
      alignments: [
        {
          match: { lensSegments: ["snbt"], routeSegments: ["snbt"] },
          programKey: LearningProgramKeySchema.make("snbt"),
        },
        {
          match: { lensSegments: ["snbt"], routeSegments: ["snbt"] },
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

/** Runs the public Effect projection at the test boundary. */
function projectCoverage(
  args: Parameters<typeof projectLearningProgramCoverageInputs>[0]
) {
  return Effect.runSync(projectLearningProgramCoverageInputs(args));
}
