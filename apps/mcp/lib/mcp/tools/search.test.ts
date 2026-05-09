import { fetchQuery } from "convex/nextjs";
import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";
import * as z from "zod";
import { getNakafaSearchContentToolResult } from "@/lib/mcp/tools/search";

vi.mock("convex/nextjs", () => ({
  fetchQuery: vi.fn(() =>
    Promise.resolve({
      count: 0,
      has_more: false,
      items: [],
      limit: 10,
      next_offset: null,
      offset: 0,
    })
  ),
}));

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

  it("returns structured read-model data errors", async () => {
    vi.mocked(fetchQuery).mockRejectedValueOnce(new Error("Convex offline"));

    const result = await Effect.runPromise(
      getNakafaSearchContentToolResult({
        locale: "en",
        query: "rational function",
      })
    );

    expect(
      ToolErrorResultSchema.parse(result).structuredContent.error
    ).toStrictEqual({
      message: "Unable to search Nakafa content.",
      suggestions: ["Convex offline"],
    });
  });
});
