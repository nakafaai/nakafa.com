import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import * as z from "zod";
import { getNakafaContentToolResult } from "@/lib/mcp/tools/content";

const ToolErrorResultSchema = z.object({
  isError: z.literal(true),
  structuredContent: z.object({
    error: z.object({
      message: z.string(),
      suggestions: z.array(z.string()).min(1),
    }),
  }),
});

describe("nakafa_get_content", () => {
  it("returns structured not-found errors", async () => {
    const result = await Effect.runPromise(
      getNakafaContentToolResult("en/articles/missing")
    );

    expect(
      ToolErrorResultSchema.parse(result).structuredContent.error.message
    ).toBe("Nakafa content was not found.");
  });
});
