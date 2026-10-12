import { describe, expect, it } from "@effect/vitest";
import {
  formatSpecialistToolTask,
  getSpecialistToolWords,
  mathToolInputSchema,
  memoryToolInputSchema,
  nakafaToolInputSchema,
  researchToolInputSchema,
} from "@repo/backend/confect/nina/contract/tools";
import { encodeJsonText } from "@repo/utilities/json";
import { asSchema } from "ai";
import dedent from "dedent";
import { Predicate } from "effect";

function readJsonSchema(schema: ReturnType<typeof asSchema>) {
  const jsonSchema = schema.jsonSchema;
  if (Predicate.isPromiseLike(jsonSchema)) {
    expect.fail("AI tool JSON Schema projection must remain synchronous.");
  }
  return jsonSchema;
}

describe("LearningCapability tool schemas", () => {
  it("uses one compact specialist input contract for every delegation tool", () => {
    const jsonSchemas = [
      readJsonSchema(asSchema(nakafaToolInputSchema)),
      readJsonSchema(asSchema(mathToolInputSchema)),
      readJsonSchema(asSchema(researchToolInputSchema)),
    ];

    for (const jsonSchema of jsonSchemas) {
      expect(jsonSchema).toMatchObject({
        properties: {
          objective: {
            type: "string",
          },
          request: {
            type: "string",
          },
          requirements: {
            type: "array",
          },
        },
        type: "object",
      });
      expect(jsonSchema.required).toEqual(
        expect.arrayContaining(["request", "objective"])
      );
      expect(jsonSchema.required).not.toContain("requirements");
      expect(jsonSchema).not.toHaveProperty("properties.task");
      expect(jsonSchema).not.toHaveProperty("properties.query");
    }
  });

  it("keeps each specialist-specific concern small and explicit", () => {
    const [nakafaJsonSchema, mathJsonSchema, jsonSchema] = [
      readJsonSchema(asSchema(nakafaToolInputSchema)),
      readJsonSchema(asSchema(mathToolInputSchema)),
      readJsonSchema(asSchema(researchToolInputSchema)),
    ];
    const json = encodeJsonText(jsonSchema);

    expect(nakafaJsonSchema).toMatchObject({
      properties: {
        deliverables: {
          type: "array",
        },
      },
      required: expect.arrayContaining(["deliverables"]),
    });
    expect(mathJsonSchema).toMatchObject({
      properties: {
        given: {
          type: "array",
        },
      },
      required: expect.arrayContaining(["given"]),
    });
    expect(jsonSchema).toMatchObject({
      properties: {
        sourceRequirements: {
          type: "array",
        },
      },
      required: expect.arrayContaining(["sourceRequirements"]),
      type: "object",
    });
    expect(json).toContain("Task-relevant user request details only");
    expect(json).toContain("Keep connective wording in the user's language");
    expect(json).toContain("Preserve technical names and terms exactly");
    expect(json).toContain("Do not translate this field into English");
    expect(json).toContain("Omit unrelated, repeated, emotional");
    expect(json).toContain("Specialist job only");
    expect(json).toContain("Source requirements only");
    expect(json).toContain("versions");
    expect(encodeJsonText(mathJsonSchema)).toContain(
      "Do not add derived formulas or solution methods"
    );
    expect(json).not.toContain("exact user wording");
    expect(json).not.toContain("userRequest");
    expect(json).toContain("Do not include final-answer wording");
    expect(json).toContain(
      "Do not include general answer-formatting, persona, or style rules"
    );
  });

  it("renders structured specialist input into one internal Markdown task", () => {
    expect(
      formatSpecialistToolTask({
        objective: "Verify the event from direct sources.",
        request: "event at SMA Tirta Lazuardi on 28 Mei 2026",
        requirements: ["Preserve the date."],
        sourceRequirements: ["Use official school channels."],
      })
    ).toContain(dedent`
      # Request

      event at SMA Tirta Lazuardi on 28 Mei 2026

      # Objective

      Verify the event from direct sources.

      # Requirements

      - Preserve the date.

      # Source Requirements

      - Use official school channels.
    `);
  });

  it("renders only populated specialist sections", () => {
    const task = formatSpecialistToolTask({
      deliverables: ["try-out evidence", "answer key"],
      objective: "Find a suitable Nakafa try-out section.",
      request: "SNBT pola bilangan try out",
      requirements: [],
    });

    expect(task).toContain(dedent`
      # Request

      SNBT pola bilangan try out

      # Objective

      Find a suitable Nakafa try-out section.

      # Deliverables

      - try-out evidence
      - answer key
    `);
    expect(task).not.toContain("# Requirements");
    expect(task).not.toContain("# Source Requirements");
    expect(task).not.toContain("# Given");
  });

  it("omits requirements when the tool call has no real constraints", () => {
    const task = formatSpecialistToolTask({
      given: ["x^2 < 9", "x > 0"],
      objective: "Solve the inequality with the domain restriction.",
      request: "x^2 < 9 dan x > 0",
    });

    expect(task).toContain(dedent`
      # Request

      x^2 < 9 dan x > 0

      # Objective

      Solve the inequality with the domain restriction.

      # Given

      - x^2 < 9
      - x > 0
    `);
    expect(task).not.toContain("# Requirements");
  });

  it("takes one query from the memory tool, of 1 to 200 characters", async () => {
    const schema = asSchema(memoryToolInputSchema);
    expect(readJsonSchema(schema)).toMatchObject({
      properties: {
        query: { maxLength: 200, minLength: 1, type: "string" },
      },
      required: ["query"],
    });
    const validate = (query: string) =>
      Promise.resolve(schema.validate?.({ query }));
    // The test names the numbers, not the constant, so a change of the limit fails it.
    expect(await validate("x")).toMatchObject({ success: true });
    expect(await validate("x".repeat(200))).toMatchObject({ success: true });
    expect(await validate("x".repeat(201))).toMatchObject({ success: false });
    expect(await validate("")).toMatchObject({ success: false });
  });

  it("renders math givens without adding response outcomes", () => {
    expect(
      formatSpecialistToolTask({
        given: ["A = [[2, 1, 0], [0, 2, 1], [0, 0, 2]]"],
        objective: "Analyze whether the matrix is diagonalizable.",
        request: "is this matrix diagonalizable?",
        requirements: ["Check eigenspace evidence."],
      })
    ).toContain(dedent`
      # Request

      is this matrix diagonalizable?

      # Objective

      Analyze whether the matrix is diagonalizable.

      # Requirements

      - Check eigenspace evidence.

      # Given

      - A = [[2, 1, 0], [0, 2, 1], [0, 0, 2]]
    `);
  });

  it.each([
    {
      tool: "Nakafa",
      input: {
        deliverables: ["try-out evidence", "answer key"],
        objective: "Find a suitable Nakafa try-out section.",
        request: "SNBT pola bilangan try out",
        requirements: ["Use the current page."],
      },
      words:
        "SNBT pola bilangan try out\nFind a suitable Nakafa try-out section.\nUse the current page.\ntry-out evidence\nanswer key",
    },
    {
      tool: "research",
      input: {
        objective: "Verify the event from direct sources.",
        request: "event at SMA Tirta Lazuardi on 28 Mei 2026",
        requirements: ["Preserve the date."],
        sourceRequirements: ["Use official school channels."],
      },
      words:
        "event at SMA Tirta Lazuardi on 28 Mei 2026\nVerify the event from direct sources.\nPreserve the date.\nUse official school channels.",
    },
    {
      tool: "math",
      input: {
        given: ["x^2 < 9", "x > 0"],
        objective: "Solve the inequality with the domain restriction.",
        request: "x^2 < 9 dan x > 0",
      },
      words:
        "x^2 < 9 dan x > 0\nSolve the inequality with the domain restriction.\nx^2 < 9\nx > 0",
    },
  ])(
    "gives the words of a $tool call, one per line, in the order of its task and with no heading",
    ({ input, words }) => {
      expect(getSpecialistToolWords(input)).toBe(words);
    }
  );

  it("leaves out a list with no item", () => {
    expect(
      getSpecialistToolWords({
        deliverables: [],
        objective: "Find a suitable Nakafa try-out section.",
        request: "SNBT pola bilangan try out",
        requirements: [],
      })
    ).toBe(
      "SNBT pola bilangan try out\nFind a suitable Nakafa try-out section."
    );
  });

  it("keeps a line of the request that starts with #, as the learner wrote it", () => {
    expect(
      getSpecialistToolWords({
        objective: "Find where the movement began.",
        request: "# Gerakan\nSiapa yang memulai gerakan itu?\n#MeToo",
        sourceRequirements: [],
      })
    ).toBe(
      "# Gerakan\nSiapa yang memulai gerakan itu?\n#MeToo\nFind where the movement began."
    );
  });
});
