import { Effect, Schema } from "effect";
import { describe, expect, it, vi } from "vitest";
import { getNakafaExerciseToolResult } from "@/lib/mcp/tools/exercise";

vi.mock("@/lib/mcp/nakafa", async () => {
  const { Effect, Option } = await import("effect");

  return {
    nakafaContent: {
      /** Returns no exercise content so the tool can shape not-found output. */
      exercise: () => Effect.succeed(Option.none()),
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

describe("nakafa_get_exercise", () => {
  it("returns structured not-found errors", async () => {
    const result = await Effect.runPromise(
      getNakafaExerciseToolResult({
        content_ref: "en/exercises/high-school/snbt/general-reasoning/missing",
      })
    );

    expect(
      Schema.decodeUnknownSync(ToolErrorResultSchema)(result).structuredContent
        .error.message
    ).toBe("Nakafa exercise content was not found.");
  });
});
