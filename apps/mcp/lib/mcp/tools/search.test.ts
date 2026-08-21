import {
  NAKAFA_AGENT_DEFAULT_LIMIT,
  NAKAFA_AGENT_MAX_LIMIT,
} from "@repo/contents/_types/agent/search";
import { afterEach, describe, expect, it } from "@repo/testing/effect";
import { fetchQuery } from "convex/nextjs";
import { Effect, Schema } from "effect";
import { vi } from "vitest";
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

afterEach(() => {
  vi.clearAllMocks();
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

describe("nakafa_search_content", () => {
  it.live(
    "decodes omitted search options with native Effect schema defaults",
    () =>
      Effect.gen(function* () {
        const result = yield* getNakafaSearchContentToolResult({});
        const searchInput = vi.mocked(fetchQuery).mock.calls.at(0)?.at(1);

        expect(result.isError).not.toBe(true);
        expect(searchInput).toStrictEqual({
          limit: NAKAFA_AGENT_DEFAULT_LIMIT,
          locale: "en",
          offset: 0,
        });
      })
  );

  it.live("returns structured read-model input errors", () =>
    Effect.gen(function* () {
      const result = yield* getNakafaSearchContentToolResult({
        limit: 99,
        locale: "en",
      });
      const error = yield* Schema.decodeUnknownEffect(ToolErrorResultSchema)(
        result
      );

      expect(error.structuredContent.error).toStrictEqual({
        message: "Invalid Nakafa content search options.",
        suggestions: [
          expect.stringContaining(
            `Expected a number between 1 and ${NAKAFA_AGENT_MAX_LIMIT}`
          ),
        ],
      });
    })
  );

  it.live("returns structured read-model data errors", () =>
    Effect.gen(function* () {
      vi.mocked(fetchQuery).mockRejectedValueOnce(new Error("Convex offline"));

      const result = yield* getNakafaSearchContentToolResult({
        locale: "en",
        queries: ["rational function"],
      });
      const error = yield* Schema.decodeUnknownEffect(ToolErrorResultSchema)(
        result
      );

      expect(error.structuredContent.error).toStrictEqual({
        message: "Unable to search Nakafa content.",
        suggestions: ["Convex offline"],
      });
    })
  );
});
