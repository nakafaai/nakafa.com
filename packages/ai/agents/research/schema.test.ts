import {
  ResearchOutputSchema,
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
      expect(invalid.left.message).toContain("Expected a public http(s) URL.");
    }
  });

  it("rejects non-public scrape URL targets before tool execution", () => {
    const localhost = Schema.decodeUnknownEither(ScrapeInputSchema)({
      urlToCrawl: "http://localhost:3000/private",
    });
    const privateIp = Schema.decodeUnknownEither(ScrapeInputSchema)({
      urlToCrawl: "http://10.0.0.1/admin",
    });
    const mappedPrivateIp = Schema.decodeUnknownEither(ScrapeInputSchema)({
      urlToCrawl: "http://[::ffff:127.0.0.1]/admin",
    });
    const unsupportedScheme = Schema.decodeUnknownEither(ScrapeInputSchema)({
      urlToCrawl: "file:///etc/passwd",
    });

    expect(Either.isLeft(localhost)).toBe(true);
    expect(Either.isLeft(privateIp)).toBe(true);
    expect(Either.isLeft(mappedPrivateIp)).toBe(true);
    expect(Either.isLeft(unsupportedScheme)).toBe(true);
  });

  it("validates optimized web-search query arrays", () => {
    const valid = Schema.decodeUnknownEither(WebSearchInputSchema)({
      queries: ["AI SDK DevTools official documentation"],
      sourcePreference: "primary",
    });
    const invalid = Schema.decodeUnknownEither(WebSearchInputSchema)({
      queries: [],
      sourcePreference: "any",
    });
    const missingPreference = Schema.decodeUnknownEither(WebSearchInputSchema)({
      queries: ["AI SDK DevTools documentation"],
    });
    const invalidPreference = Schema.decodeUnknownEither(WebSearchInputSchema)({
      queries: ["AI SDK DevTools official documentation"],
      sourcePreference: "official",
    });

    expect(Either.isRight(valid)).toBe(true);
    expect(Either.isLeft(invalid)).toBe(true);
    expect(Either.isLeft(missingPreference)).toBe(true);
    expect(Either.isLeft(invalidPreference)).toBe(true);
  });

  it("validates structured research findings with citation data", () => {
    const valid = Schema.decodeUnknownEither(ResearchOutputSchema)({
      findings: [
        {
          text: "AI SDK DevTools uses local debugging middleware.",
          citations: [
            {
              title: "AI SDK",
              url: "https://ai-sdk.dev/docs/ai-sdk-core/devtools",
            },
          ],
        },
      ],
      limitations: [],
    });
    const invalid = Schema.decodeUnknownEither(ResearchOutputSchema)({
      findings: [
        {
          text: "Missing citation URL.",
          citations: [{ title: "AI SDK", url: "not-a-url" }],
        },
      ],
      limitations: [],
    });

    expect(Either.isRight(valid)).toBe(true);
    expect(Either.isLeft(invalid)).toBe(true);
  });
});
