import { describe, expect, it } from "@effect/vitest";
import {
  mcpToolOutputSchema,
  runMcpTool,
  toMcpToolError,
} from "@repo/backend/agent/mcp/result";
import { toMcpOutputSchema } from "@repo/backend/agent/mcp/schema";
import {
  NakafaAgentDataReadError,
  NakafaAgentInputError,
} from "@repo/contents/agent/errors";
import { JsonTextSchema } from "@repo/utilities/json";
import { Effect, Logger, Schema } from "effect";

describe("Nakafa MCP tool results", () => {
  it.effect(
    "provides recovery guidance when input failure has no extra cause",
    () =>
      Effect.gen(function* () {
        const result = yield* runMcpTool(
          Effect.fail(new NakafaAgentInputError({ message: "Invalid input." })),
          "request-without-cause"
        );
        expect(result).toMatchObject({
          isError: true,
          structuredContent: {
            error: {
              message: "Invalid input.",
              suggestions: [
                "Correct the tool arguments using the published input schema and retry.",
              ],
            },
          },
        });
      })
  );

  it.effect("keeps private read failures out of public tool guidance", () =>
    Effect.gen(function* () {
      const result = yield* runMcpTool(
        Effect.fail(
          new NakafaAgentDataReadError({
            message: "Published content unavailable.",
            cause: "private storage diagnostic",
          })
        ),
        "request-read-failure"
      );
      expect(result).toMatchObject({
        isError: true,
        structuredContent: {
          error: {
            message: "Published content unavailable.",
            suggestions: ["Retry later using the same documented arguments."],
          },
        },
      });
      const json = yield* Schema.encodeUnknownEffect(JsonTextSchema)(result);
      expect(json).not.toContain("private storage diagnostic");
    })
  );

  it.effect(
    "reports a traceable request identity for defects without exposing details",
    () =>
      Effect.gen(function* () {
        const result = yield* runMcpTool(
          Effect.die(new Error("private defect diagnostic")),
          "request-defect"
        ).pipe(Effect.provide(Logger.layer([])));
        expect(result).toMatchObject({
          isError: true,
          structuredContent: {
            error: {
              message: "Nakafa MCP could not complete this request.",
              suggestions: [
                "Retry later and include request ID request-defect with support.",
              ],
            },
          },
        });
        const json = yield* Schema.encodeUnknownEffect(JsonTextSchema)(result);
        expect(json).not.toContain("private defect diagnostic");
      })
  );

  it.effect("preserves successful structured content", () =>
    Effect.gen(function* () {
      const result = yield* runMcpTool(
        Effect.succeed({ status: "ok" as const }),
        "request-success"
      );

      expect(result).toEqual({
        content: [{ text: '{"status":"ok"}', type: "text" }],
        structuredContent: { status: "ok" },
      });
    })
  );

  it.effect("maps expected input failures to the established error shape", () =>
    Effect.gen(function* () {
      const result = yield* runMcpTool(
        Effect.fail(
          new NakafaAgentInputError({
            cause: "Use one of the published locale values.",
            message: "Invalid tool arguments.",
          })
        ),
        "request-input"
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

  it.effect("advertises success and error structured content", () =>
    Effect.gen(function* () {
      const schema = yield* toMcpOutputSchema(
        mcpToolOutputSchema(Schema.Struct({ status: Schema.Literal("ok") }))
      );

      expect(schema).toMatchObject({
        anyOf: [
          expect.objectContaining({ type: "object" }),
          expect.objectContaining({ type: "object" }),
        ],
        type: "object",
      });
    })
  );
});
