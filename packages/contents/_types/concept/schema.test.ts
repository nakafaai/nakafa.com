import {
  CONCEPT_REGISTRY,
  findConceptByKey,
  getConceptRegistryIssues,
} from "@repo/contents/_types/concept/registry";
import {
  ConceptKeySchema,
  ConceptSchema,
  ConceptSkillKeySchema,
} from "@repo/contents/_types/concept/schema";
import { Either, Schema } from "effect";
import { describe, expect, it } from "vitest";

describe("concept/schema", () => {
  it("keeps canonical concepts language-neutral and schema-owned", () => {
    expect(CONCEPT_REGISTRY.every(Schema.is(ConceptSchema))).toBe(true);
    expect(CONCEPT_REGISTRY.map((concept) => concept.key)).toContain(
      "math.statistics.mean"
    );
    expect(JSON.stringify(CONCEPT_REGISTRY)).not.toContain(
      "subject/high-school"
    );
    expect(getConceptRegistryIssues()).toEqual([]);
  });

  it("finds concepts by canonical key", () => {
    expect(
      findConceptByKey("math.statistics.mean")?.translations.en.title
    ).toBe("Mean");
    expect(findConceptByKey("math.missing")).toBeNull();
  });

  it("rejects malformed concept and skill keys", () => {
    expect(Schema.is(ConceptKeySchema)("math.statistics.mean")).toBe(true);
    expect(Schema.is(ConceptKeySchema)("subject/high-school/10/math")).toBe(
      false
    );

    const invalidConcept = Schema.decodeUnknownEither(ConceptKeySchema)(
      "subject/high-school/10/math"
    );
    const invalidSkill = Schema.decodeUnknownEither(ConceptSkillKeySchema)(
      "Solve Linear Equation"
    );

    expect(Either.isLeft(invalidConcept)).toBe(true);
    expect(Either.isLeft(invalidSkill)).toBe(true);

    if (Either.isLeft(invalidConcept)) {
      expect(invalidConcept.left.message).toContain(
        "Invalid concept key. Expected lowercase dot/kebab segments."
      );
    }
    if (Either.isLeft(invalidSkill)) {
      expect(invalidSkill.left.message).toContain(
        "Invalid concept skill key. Expected lowercase kebab-case."
      );
    }
  });

  it("reports unknown prerequisite concepts", () => {
    const [concept] = CONCEPT_REGISTRY;

    expect(
      getConceptRegistryIssues([
        {
          ...concept,
          prerequisites: [ConceptKeySchema.make("math.missing")],
        },
      ])
    ).toEqual([
      `Unknown prerequisite concept key: math.missing for ${concept.key}`,
    ]);
  });
});
