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
        key: "ccss.algebra-1.statistics",
        level: "unit",
        programKey: "us-common-core-math",
        translations: {
          en: { description: "Statistics standards.", title: "Statistics" },
          id: { description: "Standar statistika.", title: "Statistika" },
        },
      })
    ).toBe(true);
    expect(
      validate(learningOutcomeInputValidator, {
        code: "HSS-ID.A.2",
        key: "ccss.math.hss-id.a.2",
        outlineKey: "ccss.algebra-1.statistics",
        programKey: "us-common-core-math",
        source: {
          label: "Common Core",
          retrievedAt: "2026-06-15",
          type: "official-policy",
          url: "https://www.thecorestandards.org/Math/",
        },
        status: "planned",
        translations: {
          en: { description: "Summarize data.", title: "Summarize data" },
          id: { description: "Merangkum data.", title: "Merangkum data" },
        },
        versionLabel: "2010",
      })
    ).toBe(true);
    expect(
      validate(outcomeConceptAlignmentInputValidator, {
        conceptKey: "math.statistics.mean",
        evidence: "Official statistics standard.",
        outcomeKey: "ccss.math.hss-id.a.2",
        relation: "covers",
        reviewedAt: "2026-06-15",
      })
    ).toBe(true);
    expect(
      validate(outcomeConceptAlignmentInputValidator, {
        conceptKey: "math.statistics.mean",
        evidence: "Bad relation.",
        outcomeKey: "ccss.math.hss-id.a.2",
        relation: "overlaps",
        reviewedAt: "2026-06-15",
      })
    ).toBe(false);
  });
});
