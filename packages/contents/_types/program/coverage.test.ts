import {
  getDefaultLearningProgramKey,
  LEARNING_PROGRAM_CATALOG,
} from "@repo/contents/_types/program/catalog";
import {
  createLearningProgramCoverageInputs,
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

const subjectRoute = decodeRoute({
  assetId: "asset:id:subject:high-school:10:chemistry:subject-topic:atomic",
  kind: "subject-topic",
  lensId: "lens:subject:high-school:10:chemistry",
  locale: "id",
  route: "subject/high-school/10/chemistry/atomic-structure",
});

const snbtRoute = decodeRoute({
  assetId: "asset:id:exercise:high-school:snbt:quantitative:exercise-set:set-1",
  kind: "exercise-set",
  lensId: "lens:exercise:high-school:snbt:quantitative-knowledge",
  locale: "id",
  route: "exercises/high-school/snbt/quantitative-knowledge/try-out/2026/set-1",
});

const englishSubjectRoute = decodeRoute({
  ...subjectRoute,
  assetId: "asset:en:subject:high-school:10:chemistry:subject-topic:atomic",
  locale: "en",
});

describe("program/coverage", () => {
  it("centralizes coverage ownership for source-registry routes", () => {
    expect(getProgramKeysForCoverageRoute(subjectRoute)).toEqual([
      "id-kurikulum-merdeka",
      "nakafa-stem-path",
    ]);
    expect(getProgramKeysForCoverageRoute(snbtRoute)).toEqual(["snbt-2026"]);
  });

  it("maps new subject topics through route-kind ownership without per-subject rows", () => {
    const newTopicRoute = decodeRoute({
      assetId: "asset:id:subject:high-school:10:biology:subject-topic:cells",
      kind: "subject-topic",
      lensId: "lens:subject:high-school:10:biology",
      locale: "id",
      route: "subject/high-school/10/biology/cell-structure",
    });

    expect(getProgramKeysForCoverageRoute(newTopicRoute)).toEqual([
      "id-kurikulum-merdeka",
      "nakafa-stem-path",
    ]);
  });

  it("falls back only through explicit fallback alignment rules", () => {
    const unmatchedRoute = decodeRoute({
      assetId: "asset:id:article:learning:general",
      kind: "exercise-set",
      lensId: "lens:article:general",
      locale: "id",
      route: "articles/learning/general",
    });

    expect(
      getProgramKeysForCoverageRoute(unmatchedRoute, [
        {
          match: { fallback: true },
          programKey: getDefaultLearningProgramKey(),
        },
      ])
    ).toEqual([getDefaultLearningProgramKey()]);
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
    expect(rowsByProgram["nakafa-stem-path"]).toMatchObject({
      coverageStatus: "available",
    });
    expect(rowsByProgram["snbt-2026"]).toMatchObject({ lensScope: "exam" });
    expect(JSON.stringify(rows)).not.toContain("exercises/high-school/snbt");
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
    expect(rowsByProgramAndLocale["nakafa-stem-path:id"]).toMatchObject({
      coverageStatus: "available",
    });
    expect(rowsByProgramAndLocale["nakafa-stem-path:en"]).toMatchObject({
      coverageStatus: "available",
    });
  });

  it("keeps coverage statuses honest for duplicates and hidden catalog rows", () => {
    const duplicateSubjectRoute = decodeRoute({
      ...subjectRoute,
      assetId: "asset:id:subject:high-school:10:chemistry:subject-topic:ions",
      route: "subject/high-school/10/chemistry/ions",
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
    expect(rowsByProgram["nakafa-stem-path"]).toMatchObject({
      contentCount: 2,
      coverageStatus: "available",
    });
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
