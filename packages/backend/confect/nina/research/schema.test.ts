import { describe, expect, it } from "@effect/vitest";
import {
  ResearchOutputSchema,
  researchOutputSchema,
  ScrapeInputSchema,
  WebSearchInputSchema,
} from "@repo/backend/confect/nina/research/schema";
import { encodeJsonText } from "@repo/utilities/json";
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
    const spaced = Schema.decodeResult(ResearchOutputSchema)({
      findings: [
        {
          text: "A link stays a link.",
          citations: [{ title: " AI SDK ", url: "https://ai-sdk.dev/docs\n" }],
        },
      ],
      limitations: [],
    });
    expect(Result.isSuccess(cited)).toBe(true);
    expect(Result.isSuccess(stray)).toBe(true);
    expect(Result.isFailure(blank)).toBe(true);
    expect(Result.getOrThrow(spaced).findings[0]?.citations).toEqual([
      { title: "AI SDK", url: "https://ai-sdk.dev/docs" },
    ]);
  });
  it("accepts an answer that holds only limitations", () => {
    const valid = Schema.decodeResult(ResearchOutputSchema)({
      findings: [],
      limitations: ["No retrieved direct source supported a citeable claim."],
    });
    expect(Result.isSuccess(valid)).toBe(true);
  });
  it("tells the synthesis model to return the closest thing, scoped, and to always name what the sources do not cover", async () => {
    const jsonSchema = await researchOutputSchema.jsonSchema;
    expect(jsonSchema).toMatchObject({
      properties: {
        findings: {
          description: expect.stringContaining(
            "what the sources state about the closest thing to the task"
          ),
          items: {
            properties: {
              text: {
                description: expect.stringContaining(
                  "say exactly what it covers, such as its year or version"
                ),
              },
            },
          },
        },
        limitations: {
          description: expect.stringContaining(
            "When a finding covers only the closest thing to the task, always include one limitation that names the part of the task the collected sources do not cover."
          ),
        },
      },
    });
  });
  it("makes saying what the collected sources cover and do not state the one exception to the found and absence bans, stated after them", async () => {
    const json = encodeJsonText(await researchOutputSchema.jsonSchema);
    expect(json).toContain("Do not use found or not-found wording.");
    expect(json).toContain("Do not make absence claims.");
    expect(json).toContain(
      "Saying what the collected sources cover and do not state is the one exception to both: it describes only these sources."
    );
    expect(json).toContain("Never widen it into a claim about the world.");
    expect(json.indexOf("is the one exception to both")).toBeGreaterThan(
      json.indexOf("Do not make absence claims.")
    );
  });
  it("does not limit a limitation to what could not be established, so a statement of coverage is not forbidden", async () => {
    const json = encodeJsonText(await researchOutputSchema.jsonSchema);
    expect(json).toContain(
      "Describe what this retrieval attempt could not establish."
    );
    expect(json).not.toContain("Describe only what");
  });
  it("lets the synthesis model return an empty findings array only when no source states the task or its closest thing", async () => {
    const json = encodeJsonText(await researchOutputSchema.jsonSchema);
    expect(json).toContain(
      "Use an empty array only when no collected source states anything about the task or the closest thing to it."
    );
    expect(json).not.toContain("direct citation evidence is unavailable");
  });
});
