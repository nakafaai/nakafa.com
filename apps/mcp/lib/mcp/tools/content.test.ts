import { describe, expect, it } from "@repo/testing/effect";
import { Effect, Schema } from "effect";
import { vi } from "vitest";
import { getNakafaContentToolResult } from "@/lib/mcp/tools/content";

vi.mock("@/lib/mcp/nakafa", async () => {
  const { Effect, Option } = await import("effect");

  return {
    nakafaContent: {
      /** Returns no content so the tool can shape its not-found response. */
      read: () => Effect.succeed(Option.none()),
    },
  };
});

const ToolErrorResultSchema = Schema.Struct({
  isError: Schema.Literal(true),
  structuredContent: Schema.Struct({
    error: Schema.Struct({
      message: Schema.String,
      suggestions: Schema.NonEmptyArray(Schema.String),
    }),
  }),
});

describe("nakafa_get_content", () => {
  it.live("returns structured not-found errors", () =>
    Effect.gen(function* () {
      const result = yield* getNakafaContentToolResult({
        content_ref: "https://nakafa.com/en/articles/politics/missing",
      });
      const error = yield* Schema.decodeUnknownEffect(ToolErrorResultSchema)(
        result
      );

      expect(error.structuredContent.error.message).toBe(
        "Nakafa content was not found."
      );
    })
  );
});
