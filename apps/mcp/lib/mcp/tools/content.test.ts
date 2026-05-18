import { Effect, Schema } from "effect";
import { describe, expect, it } from "vitest";
import { getNakafaContentToolResult } from "@/lib/mcp/tools/content";

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
  it("returns structured not-found errors", async () => {
    const result = await Effect.runPromise(
      getNakafaContentToolResult("en/articles/missing")
    );

    expect(
      Schema.decodeUnknownSync(ToolErrorResultSchema)(result).structuredContent
        .error.message
    ).toBe("Nakafa content was not found.");
  });
});
