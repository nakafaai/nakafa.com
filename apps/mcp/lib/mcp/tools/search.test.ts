import { fetchQuery } from "convex/nextjs";
import { Effect, Schema } from "effect";
import { describe, expect, it, vi } from "vitest";
import { getNakafaSearchContentToolResult } from "@/lib/mcp/tools/search";

vi.mock("convex/nextjs", () => ({
  fetchQuery: vi.fn(() =>
    Promise.resolve({
      count: 0,
      has_more: false,
      items: [],
      limit: 10,
      offset: 0,
    })
  ),
}));

const ToolErrorResultSchema = Schema.Struct({
  isError: Schema.Literal(true),
  structuredContent: Schema.Struct({
    error: Schema.Struct({
      message: Schema.String,
      suggestions: Schema.NonEmptyArray(Schema.String),
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
      Schema.decodeUnknownSync(ToolErrorResultSchema)(result).structuredContent
        .error
    ).toStrictEqual({
      message: "Invalid Nakafa content search options.",
      suggestions: [
        expect.stringContaining("Expected a number between 1 and 50"),
      ],
    });
  });

  it("returns structured read-model data errors", async () => {
    vi.mocked(fetchQuery).mockRejectedValueOnce(new Error("Convex offline"));

    const result = await Effect.runPromise(
      getNakafaSearchContentToolResult({
        locale: "en",
        queries: ["rational function"],
      })
    );

    expect(
      Schema.decodeUnknownSync(ToolErrorResultSchema)(result).structuredContent
        .error
    ).toStrictEqual({
      message: "Unable to search Nakafa content.",
      suggestions: ["Convex offline"],
    });
  });
});
