import { getLearningProgramCoverageAlignmentIssues } from "@repo/contents/_types/program/alignment";
import {
  getDefaultLearningProgramKey,
  LEARNING_PROGRAM_CATALOG,
  listDiscoverableLearningPrograms,
} from "@repo/contents/_types/program/catalog";
import {
  createLearningProgramCoverageInputs,
  getProgramKeysForCoverageRoute,
} from "@repo/contents/_types/program/coverage";
import {
  LearningProgramCoverageRouteSchema,
  LearningProgramSchema,
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

describe("learning programs", () => {
  it("keeps program kinds distinct and backed by Effect schemas", () => {
    const kindsByKey = Object.fromEntries(
      LEARNING_PROGRAM_CATALOG.map((program) => [program.key, program.kind])
    );

    expect(
      LEARNING_PROGRAM_CATALOG.every(Schema.is(LearningProgramSchema))
    ).toBe(true);
    expect(kindsByKey).toMatchObject({
      "id-kurikulum-merdeka": "school-curriculum",
      "snbt-2026": "admission-exam",
      "tka-2026": "assessment",
      [getDefaultLearningProgramKey()]: "nakafa-path",
    });
  });

  it("centralizes coverage ownership and hides unsupported programs", () => {
    const [program] = LEARNING_PROGRAM_CATALOG;
    const visibleKeys = listDiscoverableLearningPrograms([
      ...LEARNING_PROGRAM_CATALOG,
      { ...program, defaultCoverageStatus: "hidden", key: "hidden-program" },
    ]).map((item) => item.key);

    expect(getLearningProgramCoverageAlignmentIssues()).toEqual([]);
    expect(visibleKeys).not.toContain("hidden-program");
    expect(getProgramKeysForCoverageRoute(subjectRoute)).toEqual([
      "id-kurikulum-merdeka",
      "nakafa-stem-path",
    ]);
    expect(getProgramKeysForCoverageRoute(snbtRoute)).toEqual(["snbt-2026"]);
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
});
