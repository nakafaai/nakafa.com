import { describe, expect, it } from "@effect/vitest";
import {
  ResearchOutputSchema,
  ScrapeInputSchema,
  WebSearchInputSchema,
} from "@repo/backend/confect/nina/research/schema";
import { Result, Schema } from "effect";

describe("research schema", () => {
  it("validates scrape URLs with Effect schema", () => {
    const valid = Schema.decodeResult(ScrapeInputSchema)({
      urlToCrawl: "https://nakafa.com",
    });
    const invalid = Schema.decodeResult(ScrapeInputSchema)({
      urlToCrawl: "not-a-url",
    });
    expect(Result.isSuccess(valid)).toBe(true);
    expect(Result.isFailure(invalid)).toBe(true);
    if (Result.isFailure(invalid)) {
      expect(invalid.failure.message).toContain(
        "Expected a public http(s) URL."
      );
    }
  });
  it("rejects non-public scrape URL targets before tool execution", () => {
    const localhost = Schema.decodeResult(ScrapeInputSchema)({
      urlToCrawl: "http://localhost:3000/private",
    });
    const privateIp = Schema.decodeResult(ScrapeInputSchema)({
      urlToCrawl: "http://10.0.0.1/admin",
    });
    const mappedPrivateIp = Schema.decodeResult(ScrapeInputSchema)({
      urlToCrawl: "http://[::ffff:127.0.0.1]/admin",
    });
    const unsupportedScheme = Schema.decodeResult(ScrapeInputSchema)({
      urlToCrawl: "file:///etc/passwd",
    });
    expect(Result.isFailure(localhost)).toBe(true);
    expect(Result.isFailure(privateIp)).toBe(true);
    expect(Result.isFailure(mappedPrivateIp)).toBe(true);
    expect(Result.isFailure(unsupportedScheme)).toBe(true);
  });
  it("validates optimized web-search query arrays", () => {
    const valid = Schema.decodeResult(WebSearchInputSchema)({
      queries: ["AI SDK DevTools official documentation"],
      sourcePreference: "primary",
    });
    const invalid = Schema.decodeResult(WebSearchInputSchema)({
      queries: [],
      sourcePreference: "any",
    });
    const missingPreference = Schema.decodeUnknownResult(WebSearchInputSchema)({
      queries: ["AI SDK DevTools documentation"],
    });
    const invalidPreference = Schema.decodeUnknownResult(WebSearchInputSchema)({
      queries: ["AI SDK DevTools official documentation"],
      sourcePreference: "official",
    });
    expect(Result.isSuccess(valid)).toBe(true);
    expect(Result.isFailure(invalid)).toBe(true);
    expect(Result.isFailure(missingPreference)).toBe(true);
    expect(Result.isFailure(invalidPreference)).toBe(true);
  });
  it("asks research findings for their shape and leaves citations to the filter", () => {
    const cited = Schema.decodeResult(ResearchOutputSchema)({
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
    const stray = Schema.decodeResult(ResearchOutputSchema)({
      findings: [
        {
          text: "A stray URL drops this finding later, not the whole answer.",
          citations: [{ title: "AI SDK", url: "not-a-url" }],
        },
        { text: "So does a finding that cites nothing.", citations: [] },
      ],
      limitations: [],
    });
    const blank = Schema.decodeResult(ResearchOutputSchema)({
      findings: [{ text: "", citations: [] }],
      limitations: [],
    });
    expect(Result.isSuccess(cited)).toBe(true);
    expect(Result.isSuccess(stray)).toBe(true);
    expect(Result.isFailure(blank)).toBe(true);
  });
  it("accepts an answer that holds only limitations", () => {
    const valid = Schema.decodeResult(ResearchOutputSchema)({
      findings: [],
      limitations: ["No retrieved direct source supported a citeable claim."],
    });
    expect(Result.isSuccess(valid)).toBe(true);
  });
});
