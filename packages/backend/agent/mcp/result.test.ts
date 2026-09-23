import { describe, expect, it } from "@effect/vitest";
import {
  mcpToolOutputSchema,
  runMcpTool,
  toMcpToolError,
} from "@repo/backend/agent/mcp/result";
import { toMcpObjectSchema } from "@repo/backend/agent/mcp/schema";
import {
  NakafaAgentDataReadError,
  NakafaAgentInputError,
} from "@repo/contents/agent/errors";
import { Effect, Logger, Schema } from "effect";

describe("Nakafa MCP tool results", () => {
  it("provides recovery guidance when input failure has no extra cause", async () => {
    const result = await runMcpTool(
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
  });

  it("keeps private read failures out of public tool guidance", async () => {
    const result = await runMcpTool(
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
    expect(JSON.stringify(result)).not.toContain("private storage diagnostic");
  });

  it("reports a traceable request identity for defects without exposing details", async () => {
    const result = await runMcpTool(
      Effect.die(new Error("private defect diagnostic")).pipe(
        Effect.provide(Logger.layer([]))
      ),
      "request-defect"
    );
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
    expect(JSON.stringify(result)).not.toContain("private defect diagnostic");
  });
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
