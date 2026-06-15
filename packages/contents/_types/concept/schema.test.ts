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
  it("derives canonical concepts from reviewed outcome alignments", () => {
    expect(CONCEPT_REGISTRY.every(Schema.is(ConceptSchema))).toBe(true);
    expect(CONCEPT_REGISTRY.map((concept) => concept.key)).toContain(
      "math.statistics.mean"
    );
    expect(
      CONCEPT_REGISTRY.every((concept) => concept.references.length > 0)
    ).toBe(true);
    expect(JSON.stringify(CONCEPT_REGISTRY)).not.toContain(
      "subject/high-school"
    );
    expect(getConceptRegistryIssues()).toEqual([]);
  });

  it("finds concepts by canonical key", () => {
    expect(
      findConceptByKey("math.statistics.mean")?.references.map(
        (reference) => reference.outcomeKey
      )
    ).toEqual(["id.km.fase-e.math.statistics"]);
    expect(findConceptByKey("math.missing")).toBeNull();
  });

  it("rejects malformed concept keys", () => {
    expect(Schema.is(ConceptKeySchema)("math.statistics.mean")).toBe(true);
    expect(Schema.is(ConceptKeySchema)("subject/high-school/10/math")).toBe(
      false
    );

    const invalidConcept = Schema.decodeUnknownEither(ConceptKeySchema)(
      "subject/high-school/10/math"
    );

    expect(Either.isLeft(invalidConcept)).toBe(true);

    if (Either.isLeft(invalidConcept)) {
      expect(invalidConcept.left.message).toContain(
        "Invalid concept key. Expected lowercase dot/kebab segments."
      );
    }
  });

  it("reports duplicate outcome references in derived concept rows", () => {
    expect(
      createConceptRegistryFromOutcomeAlignments([
        {
          conceptKey: ConceptKeySchema.make("math.statistics.mean"),
          evidence: "First reviewed alignment.",
          outcomeKey: OutcomeKeySchema.make("id.km.fase-e.math.statistics"),
          relation: "covers",
          reviewedAt: Schema.decodeSync(DateOnlySchema)("2026-06-15"),
        },
      ])
    ).toEqual([
      {
        key: "math.statistics.mean",
        references: [
          {
            evidence: "First reviewed alignment.",
            outcomeKey: "id.km.fase-e.math.statistics",
            reviewedAt: "2026-06-15",
          },
        ],
      },
    ]);

    expect(
      getConceptRegistryIssues([
        {
          key: ConceptKeySchema.make("math.statistics.mean"),
          references: [
            {
              evidence: "First reviewed alignment.",
              outcomeKey: "id.km.fase-e.math.statistics",
              reviewedAt: Schema.decodeSync(DateOnlySchema)("2026-06-15"),
            },
            {
              evidence: "Second reviewed alignment.",
              outcomeKey: "id.km.fase-e.math.statistics",
              reviewedAt: Schema.decodeSync(DateOnlySchema)("2026-06-15"),
            },
          ],
        },
      ])
    ).toEqual([
      "Duplicate outcome reference: id.km.fase-e.math.statistics for concept math.statistics.mean",
    ]);
  });
});
