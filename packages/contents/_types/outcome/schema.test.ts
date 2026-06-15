import { DateOnlySchema } from "@repo/contents/_shared/date";
import {
  ConceptKeySchema,
  ConceptSchema,
} from "@repo/contents/_types/concept/schema";
import { getOutcomeRegistryIssues } from "@repo/contents/_types/outcome/map";
import {
  createOutcomeRegistry,
  findLearningOutcomeByKey,
  findProgramOutlineNodeByKey,
  LEARNING_OUTCOMES,
  OUTCOME_CONCEPT_ALIGNMENTS,
  PROGRAM_OUTCOME_SOURCES,
  PROGRAM_OUTLINE_NODES,
} from "@repo/contents/_types/outcome/registry";
import {
  LearningOutcomeSchema,
  OutcomeKeySchema,
  ProgramOutcomeSourceSchema,
  ProgramOutlineNodeKeySchema,
  ProgramOutlineNodeSchema,
} from "@repo/contents/_types/outcome/schema";
import { LEARNING_PROGRAM_CATALOG } from "@repo/contents/_types/program/catalog";
import { LearningProgramKeySchema } from "@repo/contents/_types/program/schema";
import { Either, Schema } from "effect";
import { describe, expect, it } from "vitest";

describe("outcome/schema", () => {
  const fixtureDate = Schema.decodeSync(DateOnlySchema)("2026-06-15");

  function createFixtureOutcomeSource({
    alignmentOutcomeKey = "fixture.outcome",
    rowProgramKey = "fixture-program",
    sourceProgramKey = "fixture-program",
  }: {
    alignmentOutcomeKey?: string;
    rowProgramKey?: string;
    sourceProgramKey?: string;
  } = {}) {
    const sourceKey = LearningProgramKeySchema.make(sourceProgramKey);
    const rowKey = LearningProgramKeySchema.make(rowProgramKey);

    return Schema.decodeUnknownSync(ProgramOutcomeSourceSchema)({
      conceptAlignments: [
        {
          conceptKey: ConceptKeySchema.make("concept:fixture:algebra"),
          evidence: "Reviewed fixture alignment.",
          outcomeKey: OutcomeKeySchema.make(alignmentOutcomeKey),
          relation: "covers",
          reviewedAt: fixtureDate,
        },
      ],
      outcomes: [
        {
          code: "FIXTURE-1",
          key: OutcomeKeySchema.make("fixture.outcome"),
          outlineKey: ProgramOutlineNodeKeySchema.make("fixture.outline"),
          programKey: rowKey,
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
        },
      ],
      outlineNodes: [
        {
          displayOrder: 1,
          key: ProgramOutlineNodeKeySchema.make("fixture.outline"),
          level: "topic",
          programKey: rowKey,
          translations: {
            en: { description: "Reviewed outline.", title: "Outline" },
            id: { description: "Outline tertinjau.", title: "Outline" },
          },
        },
      ],
      programKey: sourceKey,
    });
  }

  it("does not ship guessed production outcome rows", () => {
    expect(PROGRAM_OUTCOME_SOURCES).toEqual([]);
    expect(PROGRAM_OUTLINE_NODES).toEqual([]);
    expect(LEARNING_OUTCOMES).toEqual([]);
    expect(OUTCOME_CONCEPT_ALIGNMENTS).toEqual([]);
    expect(getOutcomeRegistryIssues()).toEqual([]);
  });

  it("keeps lookup helpers null-safe when official outcome rows are absent", () => {
    expect(findLearningOutcomeByKey("missing.outcome")).toBeNull();
    expect(findProgramOutlineNodeByKey("missing.outline")).toBeNull();
  });

  it("keeps outcome authoring owned by one program source module", () => {
    const source = createFixtureOutcomeSource();
    const registry = createOutcomeRegistry([source]);

    expect(registry.issues).toEqual([]);
    expect(registry.outlineNodes).toHaveLength(1);
    expect(registry.outcomes).toHaveLength(1);
    expect(registry.conceptAlignments).toHaveLength(1);
    expect(
      findLearningOutcomeByKey("fixture.outcome", registry.outcomes)?.code
    ).toBe("FIXTURE-1");
    expect(
      findProgramOutlineNodeByKey("fixture.outline", registry.outlineNodes)
        ?.level
    ).toBe("topic");
  });

  it("reports outcome rows that escape their owning program module", () => {
    const source = createFixtureOutcomeSource({
      alignmentOutcomeKey: "missing.outcome",
      rowProgramKey: "other-program",
    });

    expect(createOutcomeRegistry([source]).issues).toEqual([
      "Outline fixture.outline belongs to other-program, not source fixture-program",
      "Outcome fixture.outcome belongs to other-program, not source fixture-program",
      "Alignment for concept:fixture:algebra references missing.outcome, which is outside source fixture-program",
    ]);
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

  it("supports course-unit-target outline shapes without adding production rows", () => {
    const fixtureProgram = LearningProgramKeySchema.make("fixture-program");

    expect(
      Schema.is(ProgramOutlineNodeSchema)({
        displayOrder: 10,
        key: ProgramOutlineNodeKeySchema.make("fixture.course.unit"),
        level: "unit",
        programKey: fixtureProgram,
        translations: {
          en: { description: "Reviewed unit.", title: "Unit" },
          id: { description: "Unit tertinjau.", title: "Unit" },
        },
      })
    ).toBe(true);
    expect(
      Schema.is(LearningOutcomeSchema)({
        code: "TARGET-1",
        key: OutcomeKeySchema.make("fixture.target"),
        outlineKey: ProgramOutlineNodeKeySchema.make("fixture.course.unit"),
        programKey: fixtureProgram,
        source: {
          label: "Fixture source",
          retrievedAt: "2026-06-15",
          type: "nakafa-editorial",
          url: "https://nakafa.com/test/outcomes/fixture",
        },
        status: "active",
        translations: {
          en: {
            description: "Reviewed target.",
            title: "Target",
          },
          id: {
            description: "Target tertinjau.",
            title: "Target",
          },
        },
        versionLabel: "fixture",
      })
    ).toBe(true);
  });

  it("reports missing program, outline, outcome, and concept references", () => {
    const node = Schema.decodeUnknownSync(ProgramOutlineNodeSchema)({
      displayOrder: 1,
      key: ProgramOutlineNodeKeySchema.make("fixture.outline"),
      level: "topic",
      parentKey: ProgramOutlineNodeKeySchema.make("missing.parent"),
      programKey: LearningProgramKeySchema.make("missing-program"),
      translations: {
        en: { description: "Reviewed outline.", title: "Outline" },
        id: { description: "Outline tertinjau.", title: "Outline" },
      },
    });
    const outcome = Schema.decodeUnknownSync(LearningOutcomeSchema)({
      code: "FIXTURE-1",
      key: OutcomeKeySchema.make("fixture.outcome"),
      outlineKey: ProgramOutlineNodeKeySchema.make("missing.outline"),
      programKey: LearningProgramKeySchema.make("missing-program"),
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
    });

    expect(
      getOutcomeRegistryIssues({
        alignments: [
          {
            conceptKey: ConceptKeySchema.make("concept:subject:missing"),
            outcomeKey: OutcomeKeySchema.make("missing.outcome"),
            evidence: "Missing references.",
            relation: "covers",
            reviewedAt: fixtureDate,
          },
        ],
        concepts: [],
        outcomes: [outcome],
        outlineNodes: [node],
        programs: [],
      })
    ).toEqual([
      `Unknown learning program key: missing-program for outline ${node.key}`,
      `Unknown parent outline key: missing.parent for outline ${node.key}`,
      `Unknown learning program key: missing-program for outcome ${outcome.key}`,
      `Unknown outline key: missing.outline for outcome ${outcome.key}`,
      "Unknown outcome key: missing.outcome for concept concept:subject:missing",
      "Unknown concept key: concept:subject:missing for outcome missing.outcome",
    ]);
  });

  it("accepts outcome rows whose program, outline, and concept references exist", () => {
    const [program] = LEARNING_PROGRAM_CATALOG;

    if (!program) {
      throw new Error("Expected at least one learning program fixture.");
    }

    const source = createFixtureOutcomeSource({
      rowProgramKey: program.key,
      sourceProgramKey: program.key,
    });
    const registry = createOutcomeRegistry([source]);
    const [alignment] = registry.conceptAlignments;

    if (!alignment) {
      throw new Error("Expected one fixture concept alignment.");
    }

    const concept = Schema.decodeUnknownSync(ConceptSchema)({
      key: alignment.conceptKey,
      references: [
        {
          evidence: alignment.evidence,
          outcomeKey: alignment.outcomeKey,
          reviewedAt: alignment.reviewedAt,
        },
      ],
    });

    expect(
      getOutcomeRegistryIssues({
        alignments: registry.conceptAlignments,
        concepts: [concept],
        outcomes: registry.outcomes,
        outlineNodes: registry.outlineNodes,
        programs: [program],
      })
    ).toEqual([]);
  });
});
