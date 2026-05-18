import {
  formatSpecialistToolTask,
  mathToolInputSchema,
  nakafaToolInputSchema,
  researchToolInputSchema,
} from "@repo/ai/schema/tools";
import { asSchema } from "ai";
import dedent from "dedent";
import { describe, expect, it } from "vitest";

describe("orchestrator tool schemas", () => {
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
        expect.arrayContaining(["request", "objective", "requirements"])
      );
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
    expect(json).toContain("Keep this field in the user's language");
    expect(json).toContain("Do not translate it into English");
    expect(json).toContain("Omit unrelated, repeated, emotional");
    expect(json).toContain("Specialist job only");
    expect(json).toContain("Source requirements only");
    expect(json).toContain("versions");
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

      # Task

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

      # Task

      Find a suitable Nakafa exercise set.

      # Deliverables

      - exercise evidence
      - answer key
    `);
    expect(task).not.toContain("# Requirements");
    expect(task).not.toContain("# Source Requirements");
    expect(task).not.toContain("# Given");
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

      # Task

      Analyze whether the matrix is diagonalizable.

      # Requirements

      - Check eigenspace evidence.

      # Given

      - A = [[2, 1, 0], [0, 2, 1], [0, 0, 2]]
    `);
  });
});
