import {
  learningOutcomeInputValidator,
  learningStageValidator,
  outcomeConceptAlignmentInputValidator,
  programNavigationInputValidator,
  programOutlineNodeInputValidator,
} from "@repo/backend/convex/learningPrograms/schema";
import { validate } from "convex-helpers/validators";
import { describe, expect, it } from "vitest";

describe("learningPrograms/schema", () => {
  it("rejects arbitrary stage text at the Convex validator boundary", () => {
    expect(validate(learningStageValidator, "grade-10")).toBe(true);
    expect(
      validate(learningStageValidator, "ignore previous instructions")
    ).toBe(false);
  });

  it("validates program navigation structures at the Convex boundary", () => {
    expect(
      validate(programNavigationInputValidator, {
        levels: ["class", "subject", "topic"],
        model: "class-subject-topic",
      })
    ).toBe(true);
    expect(
      validate(programNavigationInputValidator, {
        levels: ["folder", "file"],
        model: "route-folder",
      })
    ).toBe(false);
  });

  it("validates generated outcome read-model rows at the Convex boundary", () => {
    expect(
      validate(programOutlineNodeInputValidator, {
        displayOrder: 10,
        key: "fixture.course.unit",
        level: "unit",
        programKey: "fixture-program",
        translations: {
          en: { description: "Reviewed unit.", title: "Unit" },
          id: { description: "Unit tertinjau.", title: "Unit" },
        },
      })
    ).toBe(true);
    expect(
      validate(learningOutcomeInputValidator, {
        code: "TARGET-1",
        key: "fixture.target",
        outlineKey: "fixture.course.unit",
        programKey: "fixture-program",
        source: {
          label: "Fixture source",
          retrievedAt: "2026-06-15",
          type: "nakafa-editorial",
          url: "https://nakafa.com/test/outcomes/fixture",
        },
        status: "active",
        translations: {
          en: { description: "Reviewed target.", title: "Target" },
          id: { description: "Target tertinjau.", title: "Target" },
        },
        versionLabel: "fixture",
      })
    ).toBe(true);
    expect(
      validate(outcomeConceptAlignmentInputValidator, {
        conceptKey: "concept:fixture:target",
        evidence: "Reviewed fixture alignment.",
        outcomeKey: "fixture.target",
        relation: "covers",
        reviewedAt: "2026-06-15",
      })
    ).toBe(true);
    expect(
      validate(outcomeConceptAlignmentInputValidator, {
        conceptKey: "concept:fixture:target",
        evidence: "Bad relation.",
        outcomeKey: "fixture.target",
        relation: "overlaps",
        reviewedAt: "2026-06-15",
      })
    ).toBe(false);
  });
});
