import {
  mathToolInputSchema,
  nakafaToolInputSchema,
  researchToolInputSchema,
} from "@repo/ai/schema/tools";
import { asSchema } from "ai";
import { describe, expect, it } from "vitest";

describe("orchestrator tool schemas", () => {
  it("uses task for delegation tool inputs", async () => {
    const schemas = [
      nakafaToolInputSchema,
      researchToolInputSchema,
      mathToolInputSchema,
    ];

    for (const inputSchema of schemas) {
      const schema = asSchema(inputSchema);
      const jsonSchema = await Promise.resolve(schema.jsonSchema);

      expect(jsonSchema).toMatchObject({
        properties: {
          task: {
            type: "string",
          },
        },
        required: ["task"],
        type: "object",
      });
      expect(jsonSchema).not.toHaveProperty("properties.query");
    }
  });

  it("keeps research task wording preservation in the public schema", async () => {
    const schema = asSchema(researchToolInputSchema);
    const jsonSchema = await Promise.resolve(schema.jsonSchema);
    const json = JSON.stringify(jsonSchema);

    expect(json).toContain("concise Markdown brief");
    expect(json).toContain("# User Request");
    expect(json).toContain("# Task");
    expect(json).toContain("Preserve exact user wording");
    expect(json).toContain("features");
    expect(json).toContain("versions");
    expect(json).toContain("source-ownership constraints");
  });
});
