import { describe, expect, it } from "@effect/vitest";
import { searchFirecrawl } from "@repo/backend/confect/nina/research/search/provider";
import { encodeJsonText } from "@repo/utilities/json";
import { Effect } from "effect";

const firecrawlApp = vi.hoisted(() => ({ search: vi.fn() }));

vi.mock("@repo/backend/confect/nina/research/provider", () => ({
  readFirecrawlApp: () => Effect.succeed(firecrawlApp),
}));

describe("searchFirecrawl", () => {
  it.effect(
    "keeps the provider's status and never its message, which may repeat the query",
    () =>
      Effect.gen(function* () {
        firecrawlApp.search.mockRejectedValueOnce(
          Object.assign(new Error("Unauthorized for query kurikulum merdeka"), {
            status: 401,
          })
        );
        const error = yield* Effect.flip(searchFirecrawl("kurikulum merdeka"));
        expect(error).toMatchObject({
          _tag: "ResearchSearchError",
          message: "Failed to search the web. Please try again.",
          status: 401,
        });
        expect(encodeJsonText({ ...error })).not.toContain("Unauthorized");
      })
  );

  it.effect("has no status when the provider never answered", () =>
    Effect.gen(function* () {
      firecrawlApp.search.mockRejectedValueOnce(new Error("socket hang up"));
      const error = yield* Effect.flip(searchFirecrawl("kurikulum merdeka"));
      expect(error.status).toBeUndefined();
    })
  );
});
