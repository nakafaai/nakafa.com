import {
  NakafaAgentDataReadError,
  NakafaAgentInputError,
} from "@repo/contents/_lib/agent/errors";
import { describe, expect, it } from "@repo/testing/effect";
import { Effect } from "effect";
import {
  succeedMcpReadModelError,
  toMcpStructuredResult,
  toMcpToolError,
} from "@/lib/mcp/result";

describe("MCP result helpers", () => {
  it.live("formats structured success and actionable errors", () =>
    Effect.gen(function* () {
      const success = toMcpStructuredResult({ ok: true });
      const explicitError = toMcpToolError("Missing content.", [
        "Search first.",
      ]);
      const inputError = yield* succeedMcpReadModelError(
        new NakafaAgentInputError({
          cause: "Invalid locale.",
          message: "Bad input.",
        })
      );
      const dataError = yield* succeedMcpReadModelError(
        new NakafaAgentDataReadError({
          message: "Read failed.",
        })
      );
      const liftedError = yield* succeedMcpReadModelError(
        new NakafaAgentDataReadError({
          cause: "Disk unavailable.",
          message: "Read failed.",
        })
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
    })
  );
});
