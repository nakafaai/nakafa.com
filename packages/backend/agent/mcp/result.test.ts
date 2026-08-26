import { runMcpTool, toMcpToolError } from "@repo/backend/agent/mcp/result";
import { NakafaAgentInputError } from "@repo/contents/_lib/agent/errors";
import { describe, expect, it } from "@repo/testing/effect";
import { Effect } from "effect";

describe("Nakafa MCP tool results", () => {
  it("preserves successful structured content", async () => {
    const result = await runMcpTool(
      Effect.succeed({ status: "ok" as const }),
      "request-success"
    );

    expect(result).toEqual({
      content: [{ text: '{"status":"ok"}', type: "text" }],
      structuredContent: { status: "ok" },
    });
  });

  it("maps expected input failures to the established error shape", async () => {
    const result = await runMcpTool(
      Effect.fail(
        new NakafaAgentInputError({
          cause: "private parser detail",
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
          suggestions: [expect.stringContaining("Correct")],
        },
      },
    });
    expect(JSON.stringify(result)).not.toContain("private parser detail");
  });

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
});
