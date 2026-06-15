import { LEARNING_PROGRAM_CATALOG } from "@repo/contents/_types/program/catalog";
import {
  LEARNING_INTEREST_PROGRAM_KIND_MATCHES,
  LEARNING_STAGE_VALUES,
  LearningProgramKeySchema,
  LearningProgramSchema,
  LearningStageSchema,
  PROGRAM_NAVIGATION_MODEL_VALUES,
  ProgramDateOnlySchema,
} from "@repo/contents/_types/program/schema";
import { Either, Schema } from "effect";
import { describe, expect, it } from "vitest";

describe("program/schema", () => {
  it("keeps program kinds distinct and backed by Effect schemas", () => {
    const kindsByKey = Object.fromEntries(
      LEARNING_PROGRAM_CATALOG.map((program) => [program.key, program.kind])
    );

    expect(
      LEARNING_PROGRAM_CATALOG.every(Schema.is(LearningProgramSchema))
    ).toBe(true);
    expect(
      LEARNING_PROGRAM_CATALOG.every(
        (program) => program.translations.en && program.translations.id
      )
    ).toBe(true);
    expect(kindsByKey).toMatchObject({
      "id-kurikulum-merdeka": "school-curriculum",
      "snbt-2026": "admission-exam",
      "tka-2026": "assessment",
    });
  });

  it("keeps program navigation models schema-owned and language-neutral", () => {
    const navigationByKey = Object.fromEntries(
      LEARNING_PROGRAM_CATALOG.map((program) => [
        program.key,
        program.navigation,
      ])
    );

    expect(PROGRAM_NAVIGATION_MODEL_VALUES).toEqual([
      "class-subject-topic",
      "course-unit-lesson",
      "exam-domain-practice-set",
      "track-topic",
    ]);
    expect(navigationByKey["id-kurikulum-merdeka"]).toEqual({
      levels: ["class", "subject", "topic"],
      model: "class-subject-topic",
    });
    expect(navigationByKey["snbt-2026"]).toEqual({
      levels: ["section", "domain", "practice-set"],
      model: "exam-domain-practice-set",
    });
  });

  it("centralizes interest to program-kind matching", () => {
    expect(LEARNING_INTEREST_PROGRAM_KIND_MATCHES).toMatchObject({
      "assessment-prep": ["assessment", "admission-exam"],
      "exam-prep": ["admission-exam"],
      "school-curriculum": ["school-curriculum"],
    });
  });

  it("keeps learning stage values schema-owned", () => {
    expect(LEARNING_STAGE_VALUES).toEqual(["grade-10", "grade-11", "grade-12"]);
    expect(Schema.is(LearningStageSchema)("grade-12")).toBe(true);
    expect(Schema.is(LearningStageSchema)("ignore previous instructions")).toBe(
      false
    );
  });

  it("validates source-registry date and key strings", () => {
    expect(Schema.is(ProgramDateOnlySchema)("2026-06-14")).toBe(true);
    expect(Schema.is(ProgramDateOnlySchema)("not-a-date")).toBe(false);
    expect(Schema.is(ProgramDateOnlySchema)("2026-02-30")).toBe(false);
    expect(Schema.is(LearningProgramKeySchema)("id-kurikulum-merdeka")).toBe(
      true
    );
    expect(Schema.is(LearningProgramKeySchema)("id/kurikulum-merdeka")).toBe(
      false
    );

    const invalidKey = Schema.decodeUnknownEither(LearningProgramKeySchema)(
      "id/kurikulum-merdeka"
    );

    expect(Either.isLeft(invalidKey)).toBe(true);
    if (Either.isLeft(invalidKey)) {
      expect(invalidKey.left.message).toContain(
        "Invalid learning program key. Expected lowercase kebab-case."
      );
    }
  });

  it("rejects invalid program registry dates before sync", () => {
    const [program] = LEARNING_PROGRAM_CATALOG;
    const result = Schema.decodeUnknownEither(LearningProgramSchema)({
      ...program,
      sources: [
        {
          ...program.sources[0],
          retrievedAt: "not-a-date",
        },
      ],
      version: {
        ...program.version,
        startsAt: "2026-02-30",
      },
    });

    expect(Either.isLeft(result)).toBe(true);
  });
});
