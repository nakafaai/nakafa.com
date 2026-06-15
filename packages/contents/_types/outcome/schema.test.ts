import { ConceptKeySchema } from "@repo/contents/_types/concept/schema";
import { getOutcomeRegistryIssues } from "@repo/contents/_types/outcome/map";
import {
  findLearningOutcomeByKey,
  findProgramOutlineNodeByKey,
  LEARNING_OUTCOMES,
  OUTCOME_CONCEPT_ALIGNMENTS,
  PROGRAM_OUTLINE_NODES,
} from "@repo/contents/_types/outcome/registry";
import {
  LearningOutcomeSchema,
  OutcomeKeySchema,
  ProgramOutlineNodeKeySchema,
  ProgramOutlineNodeSchema,
} from "@repo/contents/_types/outcome/schema";
import { LearningProgramKeySchema } from "@repo/contents/_types/program/schema";
import { Either, Schema } from "effect";
import { describe, expect, it } from "vitest";

describe("outcome/schema", () => {
  it("keeps source-cited outcomes separate from localized content routes", () => {
    expect(
      PROGRAM_OUTLINE_NODES.every(Schema.is(ProgramOutlineNodeSchema))
    ).toBe(true);
    expect(LEARNING_OUTCOMES.every(Schema.is(LearningOutcomeSchema))).toBe(
      true
    );
    expect(
      LEARNING_OUTCOMES.every(
        (outcome) =>
          outcome.source.url.startsWith("https://") &&
          outcome.versionLabel.length > 0
      )
    ).toBe(true);
    expect(JSON.stringify(LEARNING_OUTCOMES)).not.toContain(
      "subject/high-school"
    );
    expect(getOutcomeRegistryIssues()).toEqual([]);
  });

  it("finds outcomes by official outcome key", () => {
    expect(findLearningOutcomeByKey("id.km.fase-e.math.statistics")?.code).toBe(
      "KM-FE-MATH-STATISTICS"
    );
    expect(findLearningOutcomeByKey("missing.outcome")).toBeNull();
  });

  it("finds program outline nodes by source-registry key", () => {
    expect(findProgramOutlineNodeByKey("snbt.2026.quantitative")?.level).toBe(
      "section"
    );
    expect(findProgramOutlineNodeByKey("missing.outline")).toBeNull();
  });

  it("rejects malformed outcome and outline keys", () => {
    const invalidOutcome = Schema.decodeUnknownEither(OutcomeKeySchema)(
      "subject/high-school/10/math"
    );
    const invalidOutline = Schema.decodeUnknownEither(
      ProgramOutlineNodeKeySchema
    )("Class 10");

    expect(Either.isLeft(invalidOutcome)).toBe(true);
    expect(Either.isLeft(invalidOutline)).toBe(true);

    if (Either.isLeft(invalidOutcome)) {
      expect(invalidOutcome.left.message).toContain(
        "Invalid outcome key. Expected lowercase dot/kebab segments."
      );
    }
    if (Either.isLeft(invalidOutline)) {
      expect(invalidOutline.left.message).toContain(
        "Invalid program outline node key. Expected lowercase dot/kebab segments."
      );
    }
  });

  it("supports Common Core style course-unit-standard outlines without adding fake catalog rows", () => {
    const commonCoreProgram = LearningProgramKeySchema.make(
      "us-common-core-math"
    );

    expect(
      Schema.is(ProgramOutlineNodeSchema)({
        displayOrder: 10,
        key: ProgramOutlineNodeKeySchema.make(
          "ccss.algebra-1.statistics.standard"
        ),
        level: "unit",
        programKey: commonCoreProgram,
        translations: {
          en: { description: "Statistics standards.", title: "Statistics" },
          id: { description: "Standar statistika.", title: "Statistika" },
        },
      })
    ).toBe(true);
    expect(
      Schema.is(LearningOutcomeSchema)({
        code: "HSS-ID.A.2",
        key: OutcomeKeySchema.make("ccss.math.hss-id.a.2"),
        outlineKey: ProgramOutlineNodeKeySchema.make(
          "ccss.algebra-1.statistics.standard"
        ),
        programKey: commonCoreProgram,
        source: {
          label: "Common Core State Standards for Mathematics",
          retrievedAt: "2026-06-15",
          type: "official-policy",
          url: "https://www.thecorestandards.org/Math/",
        },
        status: "planned",
        translations: {
          en: {
            description: "Use statistics to summarize data.",
            title: "Summarize data",
          },
          id: {
            description: "Gunakan statistika untuk merangkum data.",
            title: "Merangkum data",
          },
        },
        versionLabel: "2010",
      })
    ).toBe(true);
  });

  it("reports missing program, outline, outcome, and concept references", () => {
    const [node] = PROGRAM_OUTLINE_NODES;
    const [outcome] = LEARNING_OUTCOMES;
    const [alignment] = OUTCOME_CONCEPT_ALIGNMENTS;

    expect(
      getOutcomeRegistryIssues({
        alignments: [
          {
            ...alignment,
            conceptKey: ConceptKeySchema.make("math.missing"),
            outcomeKey: OutcomeKeySchema.make("missing.outcome"),
          },
        ],
        outcomes: [
          {
            ...outcome,
            outlineKey: ProgramOutlineNodeKeySchema.make("missing.outline"),
            programKey: LearningProgramKeySchema.make("missing-program"),
          },
        ],
        outlineNodes: [
          {
            ...node,
            parentKey: ProgramOutlineNodeKeySchema.make("missing.parent"),
            programKey: LearningProgramKeySchema.make("missing-program"),
          },
        ],
      })
    ).toEqual([
      `Unknown learning program key: missing-program for outline ${node.key}`,
      `Unknown parent outline key: missing.parent for outline ${node.key}`,
      `Unknown learning program key: missing-program for outcome ${outcome.key}`,
      `Unknown outline key: missing.outline for outcome ${outcome.key}`,
      "Unknown outcome key: missing.outcome for concept math.missing",
      "Unknown concept key: math.missing for outcome missing.outcome",
    ]);
  });
});
