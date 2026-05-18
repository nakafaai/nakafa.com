import { Effect, Schema } from "effect";
import { describe, expect, it } from "vitest";
import { getNakafaExerciseToolResult } from "@/lib/mcp/tools/exercise";

const ToolErrorResultSchema = Schema.Struct({
  isError: Schema.Literal(true),
  structuredContent: Schema.Struct({
    error: Schema.Struct({
      message: Schema.String,
      suggestions: Schema.NonEmptyArray(Schema.String),
    }),
  }),
});

describe("nakafa_get_exercise", () => {
  it("returns structured not-found errors", async () => {
    const result = await Effect.runPromise(
      getNakafaExerciseToolResult("en/quran/1")
    );

    expect(
      Schema.decodeUnknownSync(ToolErrorResultSchema)(result).structuredContent
        .error.message
    ).toBe("Nakafa exercise content was not found.");
  });
});
