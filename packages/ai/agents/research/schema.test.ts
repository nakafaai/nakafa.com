import {
  ScrapeInputSchema,
  WebSearchInputSchema,
} from "@repo/ai/agents/research/schema";
import { Either, Schema } from "effect";
import { describe, expect, it } from "vitest";

describe("research schema", () => {
  it("validates scrape URLs with Effect schema", () => {
    const valid = Schema.decodeUnknownEither(ScrapeInputSchema)({
      urlToCrawl: "https://nakafa.com",
    });

    const invalid = Schema.decodeUnknownEither(ScrapeInputSchema)({
      urlToCrawl: "not-a-url",
    });

    expect(Either.isRight(valid)).toBe(true);
    expect(Either.isLeft(invalid)).toBe(true);

    if (Either.isLeft(invalid)) {
      expect(invalid.left.message).toContain("Expected a valid URL.");
    }
  });

  it("validates optimized web-search query arrays", () => {
    const valid = Schema.decodeUnknownEither(WebSearchInputSchema)({
      queries: ["AI SDK DevTools official documentation"],
    });
    const invalid = Schema.decodeUnknownEither(WebSearchInputSchema)({
      queries: [],
    });

    expect(Either.isRight(valid)).toBe(true);
    expect(Either.isLeft(invalid)).toBe(true);
  });
});
