import { DateOnlySchema } from "@repo/contents/_shared/date";
import {
  CONCEPT_REGISTRY,
  createConceptRegistryFromOutcomeAlignments,
  findConceptByKey,
  getConceptRegistryIssues,
} from "@repo/contents/_types/concept/registry";
import {
  ConceptKeySchema,
  ConceptSchema,
} from "@repo/contents/_types/concept/schema";
import { OutcomeKeySchema } from "@repo/contents/_types/outcome/schema";
import { Either, Schema } from "effect";
import { describe, expect, it } from "vitest";

describe("concept/schema", () => {
  it("does not ship guessed production concepts", () => {
    expect(CONCEPT_REGISTRY).toEqual([]);
    expect(getConceptRegistryIssues()).toEqual([]);
  });

  it("derives canonical concepts from reviewed outcome alignments", () => {
    const concepts = createConceptRegistryFromOutcomeAlignments([
      {
        conceptKey: ConceptKeySchema.make("concept:fixture:secondary"),
        evidence: "Second concept alignment.",
        outcomeKey: OutcomeKeySchema.make("fixture.secondary"),
        relation: "supports",
        reviewedAt: Schema.decodeSync(DateOnlySchema)("2026-06-15"),
      },
      {
        conceptKey: ConceptKeySchema.make("concept:fixture:algebra"),
        evidence: "Second reviewed alignment.",
        outcomeKey: OutcomeKeySchema.make("fixture.z-outcome"),
        relation: "supports",
        reviewedAt: Schema.decodeSync(DateOnlySchema)("2026-06-15"),
      },
      {
        conceptKey: ConceptKeySchema.make("concept:fixture:algebra"),
        evidence: "Reviewed fixture alignment.",
        outcomeKey: OutcomeKeySchema.make("fixture.outcome"),
        relation: "covers",
        reviewedAt: Schema.decodeSync(DateOnlySchema)("2026-06-15"),
      },
    ]);

    expect(concepts.every(Schema.is(ConceptSchema))).toBe(true);
    expect(concepts).toEqual([
      {
        key: "concept:fixture:algebra",
        references: [
          {
            evidence: "Reviewed fixture alignment.",
            outcomeKey: "fixture.outcome",
            reviewedAt: "2026-06-15",
          },
          {
            evidence: "Second reviewed alignment.",
            outcomeKey: "fixture.z-outcome",
            reviewedAt: "2026-06-15",
          },
        ],
      },
      {
        key: "concept:fixture:secondary",
        references: [
          {
            evidence: "Second concept alignment.",
            outcomeKey: "fixture.secondary",
            reviewedAt: "2026-06-15",
          },
        ],
      },
    ]);
    expect(JSON.stringify(concepts)).not.toContain("subject/high-school");
    expect(
      findConceptByKey("concept:fixture:algebra", concepts)?.references.map(
        (reference) => reference.outcomeKey
      )
    ).toEqual(["fixture.outcome", "fixture.z-outcome"]);
    expect(findConceptByKey("concept:subject:missing")).toBeNull();
  });

  it("rejects malformed concept keys", () => {
    expect(Schema.is(ConceptKeySchema)("concept:fixture:valid")).toBe(true);
    expect(Schema.is(ConceptKeySchema)("fixture.target")).toBe(false);
    expect(Schema.is(ConceptKeySchema)("subject/high-school/10/math")).toBe(
      false
    );

    const invalidConcept = Schema.decodeUnknownEither(ConceptKeySchema)(
      "subject/high-school/10/math"
    );

    expect(Either.isLeft(invalidConcept)).toBe(true);

    if (Either.isLeft(invalidConcept)) {
      expect(invalidConcept.left.message).toContain(
        "Invalid concept key. Expected a graph concept ID."
      );
    }
  });

  it("reports duplicate outcome references in derived concept rows", () => {
    expect(
      createConceptRegistryFromOutcomeAlignments([
        {
          conceptKey: ConceptKeySchema.make("concept:fixture:algebra"),
          evidence: "First reviewed alignment.",
          outcomeKey: OutcomeKeySchema.make("fixture.outcome"),
          relation: "covers",
          reviewedAt: Schema.decodeSync(DateOnlySchema)("2026-06-15"),
        },
      ])
    ).toEqual([
      {
        key: "concept:fixture:algebra",
        references: [
          {
            evidence: "First reviewed alignment.",
            outcomeKey: "fixture.outcome",
            reviewedAt: "2026-06-15",
          },
        ],
      },
    ]);

    expect(
      getConceptRegistryIssues([
        {
          key: ConceptKeySchema.make("concept:fixture:algebra"),
          references: [
            {
              evidence: "First reviewed alignment.",
              outcomeKey: "fixture.outcome",
              reviewedAt: Schema.decodeSync(DateOnlySchema)("2026-06-15"),
            },
            {
              evidence: "Second reviewed alignment.",
              outcomeKey: "fixture.outcome",
              reviewedAt: Schema.decodeSync(DateOnlySchema)("2026-06-15"),
            },
          ],
        },
      ])
    ).toEqual([
      "Duplicate outcome reference: fixture.outcome for concept concept:fixture:algebra",
    ]);
  });
});
