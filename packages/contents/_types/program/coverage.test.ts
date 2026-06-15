import { DateOnlySchema } from "@repo/contents/_shared/date";
import {
  OutcomeKeySchema,
  ProgramOutlineNodeKeySchema,
} from "@repo/contents/_types/outcome/schema";
import { LEARNING_PROGRAM_CATALOG } from "@repo/contents/_types/program/catalog";
import {
  createCurriculumCoverageInputs,
  createFallbackCoverageInputs,
  createLearningProgramCoverageInputs,
  createOutcomeDerivedCoverageInputs,
  getProgramKeysForCoverageConcept,
  getProgramKeysForCoverageRoute,
} from "@repo/contents/_types/program/coverage";
import {
  LearningProgramCoverageRouteSchema,
  LearningProgramKeySchema,
} from "@repo/contents/_types/program/schema";
import { Schema } from "effect";
import { describe, expect, it } from "vitest";

const decodeRoute = Schema.decodeUnknownSync(
  LearningProgramCoverageRouteSchema
);
const fixtureDate = Schema.decodeSync(DateOnlySchema)("2026-06-15");

const subjectRoute = decodeRoute({
  assetId:
    "asset:id:subject:high-school:10:mathematics:subject-topic:mathematics:statistics",
  conceptId: "concept:subject:mathematics:statistics",
  kind: "subject-topic",
  lensId: "lens:subject:high-school:10:mathematics",
  locale: "id",
  route: "subject/high-school/10/mathematics/statistics",
});

const snbtRoute = decodeRoute({
  assetId: "asset:id:exercise:high-school:snbt:quantitative:exercise-set:set-1",
  conceptId: "concept:exercise:quantitative-knowledge:try-out",
  kind: "exercise-set",
  lensId: "lens:exercise:high-school:snbt:quantitative-knowledge",
  locale: "id",
  route: "exercises/high-school/snbt/quantitative-knowledge/try-out/2026/set-1",
});

const englishSubjectRoute = decodeRoute({
  ...subjectRoute,
  assetId:
    "asset:en:subject:high-school:10:mathematics:subject-topic:mathematics:statistics",
  locale: "en",
});

const fixtureOutcome = {
  code: "FIXTURE-1",
  key: OutcomeKeySchema.make("fixture.outcome"),
  outlineKey: ProgramOutlineNodeKeySchema.make("fixture.outline"),
  programKey: LearningProgramKeySchema.make("id-kurikulum-merdeka"),
  source: {
    label: "Fixture source",
    retrievedAt: fixtureDate,
    type: "nakafa-editorial",
    url: "https://nakafa.com",
  },
  status: "active",
  translations: {
    en: { description: "Reviewed target.", title: "Target" },
    id: { description: "Target tertinjau.", title: "Target" },
  },
  versionLabel: "fixture",
} as const;

const fixtureOutcomeAlignment = {
  conceptKey: subjectRoute.conceptId,
  evidence: "Reviewed fixture alignment.",
  outcomeKey: fixtureOutcome.key,
  relation: "covers",
  reviewedAt: fixtureDate,
} as const;

describe("program/coverage", () => {
  it("keeps assessment route rules separate from curriculum mappings", () => {
    expect(getProgramKeysForCoverageRoute(subjectRoute)).toEqual([]);
    expect(getProgramKeysForCoverageRoute(snbtRoute)).toEqual(["snbt-2026"]);
  });

  it("maps subject topics through curriculum-owned material references", () => {
    const newTopicRoute = decodeRoute({
      assetId: "asset:id:subject:high-school:10:biology:subject-topic:cells",
      conceptId: "concept:subject:biology:cell-structure",
      kind: "subject-topic",
      lensId: "lens:subject:high-school:10:biology",
      locale: "id",
      route: "subject/high-school/10/biology/cell-structure",
    });

    expect(
      createCurriculumCoverageInputs({
        programs: LEARNING_PROGRAM_CATALOG,
        routes: [newTopicRoute],
        syncedAt: 1,
      })
    ).toEqual([
      expect.objectContaining({
        programKey: "id-kurikulum-merdeka",
      }),
    ]);
  });

  it("falls back only through explicit fallback alignment rules", () => {
    const unmatchedRoute = decodeRoute({
      assetId: "asset:id:article:learning:general",
      conceptId: "concept:article:learning",
      kind: "exercise-set",
      lensId: "lens:article:general",
      locale: "id",
      route: "articles/learning/general",
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
          match: { routeKinds: ["subject-topic"] },
          programKey: LearningProgramKeySchema.make("id-kurikulum-merdeka"),
        },
      ])
    ).toEqual([]);
    expect(
      getProgramKeysForCoverageRoute(snbtRoute, [
        {
          match: { routeKinds: ["exercise-set"] },
          programKey: LearningProgramKeySchema.make("fixture-program"),
        },
      ])
    ).toEqual(["fixture-program"]);
    expect(
      getProgramKeysForCoverageRoute(snbtRoute, [
        {
          match: { lensSegments: ["tka"] },
          programKey: LearningProgramKeySchema.make("tka-2026"),
        },
      ])
    ).toEqual([]);
    expect(
      getProgramKeysForCoverageRoute(snbtRoute, [
        {
          match: { lensSegments: ["snbt"], routeSegments: ["missing"] },
          programKey: LearningProgramKeySchema.make("snbt-2026"),
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

    expect(rowsByProgram["id-kurikulum-merdeka"]).toMatchObject({
      coverageStatus: "partial",
      lensScope: "curriculum",
    });
    expect(rowsByProgram["snbt-2026"]).toMatchObject({ lensScope: "exam" });
    expect(JSON.stringify(rows)).not.toContain("exercises/high-school/snbt");
  });

  it("preserves explicit available catalog status for real program coverage", () => {
    const rows = createLearningProgramCoverageInputs({
      programs: LEARNING_PROGRAM_CATALOG.map((program) => {
        if (program.key !== "id-kurikulum-merdeka") {
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

    expect(rows).toEqual([
      expect.objectContaining({
        coverageStatus: "available",
        programKey: "id-kurikulum-merdeka",
      }),
    ]);
  });

  it("derives coverage from asset concepts and outcome alignments before route fallback", () => {
    const rows = createLearningProgramCoverageInputs({
      alignments: [],
      outcomeAlignments: [fixtureOutcomeAlignment],
      outcomes: [fixtureOutcome],
      programs: LEARNING_PROGRAM_CATALOG,
      routes: [subjectRoute, snbtRoute],
      syncedAt: 1,
    });
    const keys = rows
      .map((row) => `${row.programKey}:${row.locale}:${row.lensId}`)
      .sort();

    expect(keys).toEqual([
      "id-kurikulum-merdeka:id:lens:subject:high-school:10:mathematics",
    ]);
  });

  it("exposes direct outcome, curriculum, and fallback projection seams", () => {
    const outcomeRows = createOutcomeDerivedCoverageInputs({
      alignments: [fixtureOutcomeAlignment],
      outcomes: [fixtureOutcome],
      programs: LEARNING_PROGRAM_CATALOG,
      routes: [subjectRoute],
      syncedAt: 1,
    });
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

    expect(outcomeRows).toHaveLength(1);
    expect(outcomeRows[0]).toMatchObject({
      programKey: "id-kurikulum-merdeka",
    });
    expect(curriculumRows.map((row) => row.programKey).sort()).toEqual([
      "id-kurikulum-merdeka",
    ]);
    expect(fallbackRows).toEqual([]);
    expect(getProgramKeysForCoverageConcept(subjectRoute)).toEqual([]);
  });

  it("uses the empty production outcome registry by default", () => {
    expect(
      createOutcomeDerivedCoverageInputs({
        programs: LEARNING_PROGRAM_CATALOG,
        routes: [subjectRoute],
        syncedAt: 1,
      })
    ).toEqual([]);
  });

  it("deduplicates outcome-derived program keys and skips retired outcomes", () => {
    const activeOutcome = fixtureOutcome;
    const retiredOutcome = {
      ...fixtureOutcome,
      key: OutcomeKeySchema.make("fixture.retired"),
      status: "retired" as const,
    };
    const keys = getProgramKeysForCoverageConcept(subjectRoute, {
      alignments: [
        fixtureOutcomeAlignment,
        { ...fixtureOutcomeAlignment },
        {
          ...fixtureOutcomeAlignment,
          outcomeKey: retiredOutcome.key,
        },
        {
          ...fixtureOutcomeAlignment,
          conceptKey: snbtRoute.conceptId,
        },
      ],
      outcomes: [activeOutcome, retiredOutcome],
    });

    expect(keys).toEqual(["id-kurikulum-merdeka"]);
  });

  it("does not invent curriculum coverage for material outside a curriculum mapping", () => {
    const rows = createLearningProgramCoverageInputs({
      alignments: [],
      programs: LEARNING_PROGRAM_CATALOG,
      routes: [
        decodeRoute({
          assetId:
            "asset:id:subject:university:bachelor:ai-ds:subject-topic:nlp",
          conceptId: "concept:subject:ai-ds:nlp",
          kind: "subject-topic",
          lensId: "lens:subject:university:bachelor:ai-ds",
          locale: "id",
          route: "subject/university/bachelor/ai-ds/nlp",
        }),
      ],
      syncedAt: 1,
    });

    expect(rows).toEqual([]);
  });

  it("ignores concept alignments when the reviewed outcome row is absent", () => {
    const rows = createOutcomeDerivedCoverageInputs({
      alignments: [
        {
          conceptKey: subjectRoute.conceptId,
          evidence: "Reviewed fixture alignment.",
          outcomeKey: OutcomeKeySchema.make("missing.outcome"),
          relation: "covers",
          reviewedAt: fixtureDate,
        },
      ],
      outcomes: [],
      programs: LEARNING_PROGRAM_CATALOG,
      routes: [subjectRoute],
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

    expect(rowsByProgramAndLocale["id-kurikulum-merdeka:id"]).toMatchObject({
      coverageStatus: "partial",
    });
    expect(rowsByProgramAndLocale["id-kurikulum-merdeka:en"]).toMatchObject({
      coverageStatus: "partial",
    });
  });

  it("keeps coverage statuses honest for duplicates and hidden catalog rows", () => {
    const duplicateSubjectRoute = decodeRoute({
      ...subjectRoute,
      assetId:
        "asset:id:subject:high-school:10:mathematics:subject-topic:mathematics:statistics-practice",
      route: "subject/high-school/10/mathematics/statistics-practice",
    });
    const programs = LEARNING_PROGRAM_CATALOG.map((program) => {
      if (program.key !== "id-kurikulum-merdeka") {
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

    expect(rowsByProgram["id-kurikulum-merdeka"]).toBeUndefined();
    expect(rowsByProgram).toEqual({});
  });

  it("projects archived and unknown programs without inventing availability", () => {
    const programs = LEARNING_PROGRAM_CATALOG.map((program) => {
      if (program.key !== "snbt-2026") {
        return program;
      }

      return { ...program, defaultCoverageStatus: "archived" as const };
    });

    const rows = createLearningProgramCoverageInputs({
      alignments: [
        {
          match: { routeSegments: ["snbt"] },
          programKey: LearningProgramKeySchema.make("snbt-2026"),
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

    expect(rowsByProgram["snbt-2026"]).toMatchObject({
      coverageStatus: "archived",
    });
    expect(rowsByProgram["unknown-exam"]).toMatchObject({
      coverageStatus: "partial",
    });
  });
});
