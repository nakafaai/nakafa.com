import { LEARNING_PROGRAM_CATALOG } from "@repo/contents/_types/program/catalog";
import {
  LEARNING_INTEREST_PROGRAM_KIND_MATCHES,
  LearningProgramSchema,
} from "@repo/contents/_types/program/schema";
import { Schema } from "effect";
import { describe, expect, it } from "vitest";

describe("program/schema", () => {
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
      "nakafa-stem-path": "nakafa-path",
    });
  });

  it("centralizes interest to program-kind matching", () => {
    expect(LEARNING_INTEREST_PROGRAM_KIND_MATCHES).toMatchObject({
      "assessment-prep": ["assessment", "admission-exam"],
      "custom-plan": ["custom-program", "institution-program"],
      "exam-prep": ["admission-exam"],
      "nakafa-path": ["nakafa-path"],
      "school-curriculum": ["school-curriculum"],
    });
  });
});
