import {
  formatSpecialistToolTask,
  MathToolInputSchema,
  mathToolInputSchema,
  nakafaToolInputSchema,
  researchToolInputSchema,
} from "@repo/ai/schema/tools";
import { asSchema } from "ai";
import dedent from "dedent";
import { Either, Schema } from "effect";
import { describe, expect, it } from "vitest";

describe("LearningCapability tool schemas", () => {
  it("uses one compact specialist input contract for every delegation tool", async () => {
    const jsonSchemas = [
      await Promise.resolve(asSchema(nakafaToolInputSchema).jsonSchema),
      await Promise.resolve(asSchema(mathToolInputSchema).jsonSchema),
      await Promise.resolve(asSchema(researchToolInputSchema).jsonSchema),
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

  it("keeps each specialist-specific concern small and explicit", async () => {
    const nakafaSchema = asSchema(nakafaToolInputSchema);
    const mathSchema = asSchema(mathToolInputSchema);
    const schema = asSchema(researchToolInputSchema);
    const nakafaJsonSchema = await Promise.resolve(nakafaSchema.jsonSchema);
    const mathJsonSchema = await Promise.resolve(mathSchema.jsonSchema);
    const jsonSchema = await Promise.resolve(schema.jsonSchema);
    const json = JSON.stringify(jsonSchema);

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
        math: {
          type: "object",
        },
      },
      required: expect.arrayContaining(["given", "math"]),
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
    expect(JSON.stringify(mathJsonSchema)).toContain(
      "Do not add derived formulas or solution methods"
    );
    expect(JSON.stringify(mathJsonSchema)).toContain(
      "set variable/variables plus lower"
    );
    expect(JSON.stringify(mathJsonSchema)).toContain(
      "domain restrictions and inequalities"
    );
    expect(json).not.toContain("exact user wording");
    expect(json).not.toContain("userRequest");
    expect(json).toContain("Do not include final-answer wording");
    expect(json).toContain(
      "Do not include general answer-formatting, persona, or style rules"
    );
    expect(JSON.stringify(mathJsonSchema)).toContain(
      "Solve requests must include expression or non-empty expressions"
    );
    expect(JSON.stringify(mathJsonSchema)).toContain("incomplete expression");
    expect(JSON.stringify(mathJsonSchema)).toContain(
      "MathReasoning can fail typed"
    );
  });

  it("validates required structured fields before math tool execution", () => {
    const valid = Schema.decodeUnknownEither(MathToolInputSchema)({
      given: ["x^2 - 4 = 0"],
      math: {
        expression: "x^2 - 4 = 0",
        kind: "math",
        operation: "solve",
        variable: "x",
        variables: ["x"],
      },
      objective: "Solve the equation.",
      request: "x^2 - 4 = 0",
    });
    const missingSolveRelation = Schema.decodeUnknownEither(
      MathToolInputSchema
    )({
      given: ["x^2 - 4 = 0"],
      math: {
        kind: "math",
        operation: "solve",
        variable: "x",
        variables: ["x"],
      },
      objective: "Solve the equation.",
      request: "x^2 - 4 = 0",
    });
    const unsupportedOperation = Schema.decodeUnknownEither(
      MathToolInputSchema
    )({
      given: ["A = [[1, 0], [0, 1]]"],
      math: {
        kind: "math",
        matrix: [
          ["1", "0"],
          ["0", "1"],
        ],
        operation: "eigen_analysis",
      },
      objective: "Analyze the matrix.",
      request: "A = [[1, 0], [0, 1]]",
    });

    expect(Either.isRight(valid)).toBe(true);
    expect(Either.isLeft(missingSolveRelation)).toBe(true);
    expect(Either.isLeft(unsupportedOperation)).toBe(true);
    if (Either.isLeft(missingSolveRelation)) {
      expect(missingSolveRelation.left.message).toContain(
        "operation-specific structured fields"
      );
    }
    if (Either.isLeft(unsupportedOperation)) {
      expect(unsupportedOperation.left.message).toContain(
        "first-slice MathReasoning operations"
      );
    }
  });

  it("validates operation-specific math tool field requirements", () => {
    const validMathRequests = [
      {
        expression: "x +",
        kind: "math",
        operation: "factor",
      },
      {
        expression: "x^2 - 4",
        kind: "math",
        operation: "factor",
      },
      {
        expression: "x^2 - 4",
        kind: "math",
        operation: "simplify",
      },
      {
        expression: "x^2",
        kind: "math",
        operation: "differentiate",
        variable: "x",
      },
      {
        expression: "x",
        kind: "math",
        operation: "integrate",
        variable: "x",
      },
      {
        expressions: ["x = 1", "y = 2"],
        kind: "math",
        operation: "solve",
        variables: ["x", "y"],
      },
      {
        kind: "math",
        operation: "line",
        points: [
          { x: "0", y: "0" },
          { x: "1", y: "1" },
        ],
      },
      {
        kind: "math",
        operation: "circle",
        pointSemantics: "circle-radius-point",
        points: [
          { x: "0", y: "0" },
          { x: "1", y: "0" },
        ],
      },
    ];
    const invalidMathRequests = [
      {
        kind: "math",
        operation: "factor",
      },
      {
        kind: "math",
        operation: "simplify",
      },
      {
        kind: "math",
        operation: "differentiate",
        variable: "x",
      },
      {
        kind: "math",
        operation: "integrate",
        variable: "x",
      },
      {
        kind: "math",
        operation: "line",
        points: [{ x: "0", y: "0" }],
      },
      {
        kind: "math",
        operation: "line",
      },
      {
        kind: "math",
        operation: "circle",
        pointSemantics: "circle-radius-point",
        points: [{ x: "0", y: "0" }],
      },
      {
        kind: "math",
        operation: "circle",
        pointSemantics: "circle-radius-point",
      },
      {
        kind: "math",
        operation: "circle",
        points: [
          { x: "0", y: "0" },
          { x: "1", y: "0" },
        ],
      },
    ];

    for (const math of validMathRequests) {
      const decoded = Schema.decodeUnknownEither(MathToolInputSchema)({
        given: ["structured math evidence"],
        math,
        objective: "Verify the structured math request.",
        request: "structured math request",
      });

      expect(decoded._tag).toBe("Right");
    }

    for (const math of invalidMathRequests) {
      const decoded = Schema.decodeUnknownEither(MathToolInputSchema)({
        given: ["structured math evidence"],
        math,
        objective: "Verify the structured math request.",
        request: "structured math request",
      });

      expect(decoded._tag).toBe("Left");
    }
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
      deliverables: ["exercise evidence", "answer key"],
      objective: "Find a suitable Nakafa exercise set.",
      request: "SNBT pola bilangan practice",
      requirements: [],
    });

    expect(task).toContain(dedent`
      # Request

      SNBT pola bilangan practice

      # Objective

      Find a suitable Nakafa exercise set.

      # Deliverables

      - exercise evidence
      - answer key
    `);
    expect(task).not.toContain("# Requirements");
    expect(task).not.toContain("# Source Requirements");
    expect(task).not.toContain("# Given");
  });

  it("omits requirements when the tool call has no real constraints", () => {
    const task = formatSpecialistToolTask({
      given: ["x^2 < 9", "x > 0"],
      math: {
        expression: "x^2 < 9",
        kind: "math",
        lower: "0",
        operation: "solve",
        variable: "x",
        variables: ["x"],
      },
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

      # Math

      {"expression":"x^2 < 9","kind":"math","lower":"0","operation":"solve","variable":"x","variables":["x"]}
    `);
    expect(task).not.toContain("# Requirements");
  });

  it("renders math givens without adding response outcomes", () => {
    expect(
      formatSpecialistToolTask({
        given: ["A = [[2, 1, 0], [0, 2, 1], [0, 0, 2]]"],
        math: {
          kind: "math",
          matrix: [
            ["2", "1", "0"],
            ["0", "2", "1"],
            ["0", "0", "2"],
          ],
          operation: "eigen_analysis",
        },
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
});
