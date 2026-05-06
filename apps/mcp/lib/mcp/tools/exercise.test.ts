import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import * as z from "zod";
import { getNakafaExerciseToolResult } from "@/lib/mcp/tools/exercise";

const ToolErrorResultSchema = z.object({
  isError: z.literal(true),
  structuredContent: z.object({
    error: z.object({
      message: z.string(),
      suggestions: z.array(z.string()).min(1),
    }),
  }),
});

describe("nakafa_get_exercise", () => {
  it("returns structured not-found errors", async () => {
    const result = await Effect.runPromise(
      getNakafaExerciseToolResult("en/quran/1")
    );

    expect(
      ToolErrorResultSchema.parse(result).structuredContent.error.message
    ).toBe("Nakafa exercise content was not found.");
  });
});
