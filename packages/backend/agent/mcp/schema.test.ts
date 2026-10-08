import { describe, expect, it } from "@effect/vitest";
import {
  toMcpInputSchema,
  toMcpOutputSchema,
} from "@repo/backend/agent/mcp/schema";
import { Effect, Schema } from "effect";

describe("MCP object schemas", () => {
  it.effect("keeps input and output schemas object-rooted", () =>
    Effect.gen(function* () {
      const source = Schema.Union([
        Schema.Struct({ status: Schema.Literal("ok") }),
        Schema.Struct({ error: Schema.String }),
      ]);
      const input = yield* toMcpInputSchema(source);
      const output = yield* toMcpOutputSchema(source);

      expect(input).toMatchObject({ anyOf: expect.any(Array), type: "object" });
      expect(output).toMatchObject({
        anyOf: expect.any(Array),
        type: "object",
      });
    })
  );
});
