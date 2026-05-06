import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import * as z from "zod";
import { getNakafaSearchContentToolResult } from "@/lib/mcp/tools/search";

const ToolErrorResultSchema = z.object({
  isError: z.literal(true),
  structuredContent: z.object({
    error: z.object({
      message: z.string(),
      suggestions: z.array(z.string()).min(1),
    }),
  }),
});

describe("nakafa_search_content", () => {
  it("returns structured read-model input errors", async () => {
    const result = await Effect.runPromise(
      getNakafaSearchContentToolResult({
        limit: 99,
        locale: "en",
      })
    );

    expect(
      ToolErrorResultSchema.parse(result).structuredContent.error
    ).toStrictEqual({
      message: "Invalid Nakafa content search options.",
      suggestions: [
        expect.stringContaining("Too big: expected number to be <=50"),
      ],
    });
  });
});
