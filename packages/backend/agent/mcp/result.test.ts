import { describe, expect, it } from "@effect/vitest";
import {
  mcpToolOutputSchema,
  runMcpTool,
  toMcpToolError,
} from "@repo/backend/agent/mcp/result";
import { toMcpObjectSchema } from "@repo/backend/agent/mcp/schema";
import { NakafaAgentInputError } from "@repo/contents/_lib/agent/errors";
import { Effect, Schema } from "effect";

describe("Nakafa MCP tool results", () => {
  it.effect("preserves successful structured content", () =>
    Effect.gen(function* () {
      const result = yield* Effect.promise(() =>
        runMcpTool(Effect.succeed({ status: "ok" as const }), "request-success")
      );

      expect(result).toEqual({
        content: [{ text: '{"status":"ok"}', type: "text" }],
        structuredContent: { status: "ok" },
      });
    })
  );

  it.effect("maps expected input failures to the established error shape", () =>
    Effect.gen(function* () {
      const result = yield* Effect.promise(() =>
        runMcpTool(
          Effect.fail(
            new NakafaAgentInputError({
              cause: "Use one of the published locale values.",
              message: "Invalid tool arguments.",
            })
          ),
          "request-input"
        )
      );

      expect(result).toMatchObject({
        isError: true,
        structuredContent: {
          error: {
            message: "Invalid tool arguments.",
            suggestions: ["Use one of the published locale values."],
          },
        },
      });
    })
  );

  it("builds non-empty actionable error guidance", () => {
    expect(
      toMcpToolError("Content unavailable.", ["Retry later."])
    ).toMatchObject({
      isError: true,
      structuredContent: {
        error: {
          message: "Content unavailable.",
          suggestions: ["Retry later."],
        },
      },
    });
  });

  it("advertises success and error structured content", () => {
    const schema = toMcpObjectSchema(
      mcpToolOutputSchema(Schema.Struct({ status: Schema.Literal("ok") }))
    );
    const error = {
      error: { message: "Unavailable.", suggestions: ["Retry later."] },
    };
    const successValidation = schema["~standard"].validate({ status: "ok" });
    const errorValidation = schema["~standard"].validate(error);

    expect(successValidation).toMatchObject({ value: { status: "ok" } });
    expect(errorValidation).toMatchObject({ value: error });
    expect(
      schema["~standard"].jsonSchema.output({ target: "draft-2020-12" })
    ).toMatchObject({
      anyOf: expect.any(Array),
      type: "object",
    });
  });
});
