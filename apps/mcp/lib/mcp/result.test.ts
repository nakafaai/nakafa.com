import {
  NakafaAgentDataReadError,
  NakafaAgentInputError,
} from "@repo/contents/_lib/agent/errors";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import {
  succeedMcpReadModelError,
  toMcpStructuredResult,
  toMcpToolError,
} from "@/lib/mcp/result";

describe("MCP result helpers", () => {
  it("formats structured success and actionable errors", async () => {
    const success = toMcpStructuredResult({ ok: true });
    const explicitError = toMcpToolError("Missing content.", ["Search first."]);
    const inputError = await Effect.runPromise(
      succeedMcpReadModelError(
        new NakafaAgentInputError({
          cause: "Invalid locale.",
          message: "Bad input.",
        })
      )
    );
    const dataError = await Effect.runPromise(
      succeedMcpReadModelError(
        new NakafaAgentDataReadError({
          message: "Read failed.",
        })
      )
    );
    const liftedError = await Effect.runPromise(
      succeedMcpReadModelError(
        new NakafaAgentDataReadError({
          cause: "Disk unavailable.",
          message: "Read failed.",
        })
      )
    );

    expect(success.structuredContent).toStrictEqual({ ok: true });
    expect(explicitError.isError).toBe(true);
    expect(inputError.structuredContent.error.suggestions[0]).toBe(
      "Invalid locale."
    );
    expect(dataError.structuredContent.error.suggestions[0]).toContain(
      "nakafa_get_taxonomy"
    );
    expect(liftedError.structuredContent.error.suggestions).toStrictEqual([
      "Disk unavailable.",
    ]);
  });
});
