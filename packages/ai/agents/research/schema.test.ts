import { describe, expect, it } from "@effect/vitest";
import {
  ResearchOutputSchema,
  ScrapeInputSchema,
  WebSearchInputSchema,
} from "@repo/ai/agents/research/schema";
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
  it("validates structured research findings with citation data", () => {
    const valid = Schema.decodeResult(ResearchOutputSchema)({
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
      noEvidenceAnswer: "I could not verify this from direct sources.",
    });
    const invalid = Schema.decodeResult(ResearchOutputSchema)({
      findings: [
        {
          text: "Missing citation URL.",
          citations: [{ title: "AI SDK", url: "not-a-url" }],
        },
      ],
      limitations: [],
      noEvidenceAnswer: "I could not verify this from direct sources.",
    });
    expect(Result.isSuccess(valid)).toBe(true);
    expect(Result.isFailure(invalid)).toBe(true);
  });
  it("allows empty findings when direct citation evidence is unavailable", () => {
    const valid = Schema.decodeResult(ResearchOutputSchema)({
      findings: [],
      limitations: ["No retrieved direct source supported a citeable claim."],
      noEvidenceAnswer: "I could not verify this from direct sources.",
    });
    expect(Result.isSuccess(valid)).toBe(true);
  });
  it("requires a generated no-evidence answer", () => {
    const invalid = Schema.decodeUnknownResult(ResearchOutputSchema)({
      findings: [],
      limitations: ["No retrieved direct source supported a citeable claim."],
    });
    expect(Result.isFailure(invalid)).toBe(true);
  });
});
