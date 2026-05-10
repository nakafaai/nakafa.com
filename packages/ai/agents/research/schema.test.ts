import { ScrapeInputSchema } from "@repo/ai/agents/research/schema";
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
});
