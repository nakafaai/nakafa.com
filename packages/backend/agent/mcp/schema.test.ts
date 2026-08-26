import { toMcpObjectSchema } from "@repo/backend/agent/mcp/schema";
import { describe, expect, it } from "@repo/testing/effect";
import { Schema } from "effect";

describe("MCP object schemas", () => {
  it("keeps input and output schemas object-rooted", () => {
    const schema = toMcpObjectSchema(
      Schema.Union([
        Schema.Struct({ status: Schema.Literal("ok") }),
        Schema.Struct({ error: Schema.String }),
      ])
    );
    const input = schema["~standard"].jsonSchema.input({
      target: "draft-2020-12",
    });
    const output = schema["~standard"].jsonSchema.output({
      target: "draft-2020-12",
    });

    expect(input).toMatchObject({ anyOf: expect.any(Array), type: "object" });
    expect(output).toMatchObject({ anyOf: expect.any(Array), type: "object" });
  });
});
