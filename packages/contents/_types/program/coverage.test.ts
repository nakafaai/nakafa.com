import {
  getDefaultLearningProgramKey,
  LEARNING_PROGRAM_CATALOG,
} from "@repo/contents/_types/program/catalog";
import {
  createLearningProgramCoverageInputs,
  getProgramKeysForCoverageRoute,
} from "@repo/contents/_types/program/coverage";
import { LearningProgramCoverageRouteSchema } from "@repo/contents/_types/program/schema";
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

describe("program/coverage", () => {
  it("centralizes coverage ownership for source-registry routes", () => {
    expect(getProgramKeysForCoverageRoute(subjectRoute)).toEqual([
      "id-kurikulum-merdeka",
      "nakafa-stem-path",
    ]);
    expect(getProgramKeysForCoverageRoute(snbtRoute)).toEqual(["snbt-2026"]);
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
          programKey: "id-kurikulum-merdeka",
        },
      ])
    ).toEqual([]);
    expect(
      getProgramKeysForCoverageRoute(snbtRoute, [
        {
          match: { lensSegments: ["tka"] },
          programKey: "tka-2026",
        },
      ])
    ).toEqual([]);
    expect(
      getProgramKeysForCoverageRoute(snbtRoute, [
        {
          match: { lensSegments: ["snbt"], routeSegments: ["missing"] },
          programKey: "snbt-2026",
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
          programKey: "snbt-2026",
        },
        {
          match: { routeSegments: ["snbt"] },
          programKey: "unknown-exam",
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
