import { describe, expect, it } from "@effect/vitest";
import { readNakafaContentRefFixture } from "@repo/contents/_lib/agent/fixture";
import {
  NakafaAgentContentRefInputSchema,
  NakafaAgentMarkdownSchema,
} from "@repo/contents/_lib/agent/schema/read";
import { Schema } from "effect";

const quranAssetId = "asset:en:quran:quran-surah:1";

describe("NakafaAgentContentRefInputSchema", () => {
  it("accepts graph content IDs, resource URIs, and canonical URLs", () => {
    expect(
      Schema.decodeSync(NakafaAgentContentRefInputSchema)(quranAssetId)
    ).toBe(quranAssetId);
    expect(
      Schema.decodeSync(NakafaAgentContentRefInputSchema)(
        `nakafa://content/${quranAssetId}`
      )
    ).toBe(`nakafa://content/${quranAssetId}`);
    expect(
      Schema.decodeSync(NakafaAgentContentRefInputSchema)(
        "https://nakafa.com/en/quran/1"
      )
    ).toBe("https://nakafa.com/en/quran/1");
  });

  it("rejects bare route refs and external URLs", () => {
    expect(() =>
      Schema.decodeSync(NakafaAgentContentRefInputSchema)("en/quran/1")
    ).toThrow("Expected a Nakafa graph content ID");
    expect(() =>
      Schema.decodeSync(NakafaAgentContentRefInputSchema)("quran/1")
    ).toThrow("Expected a Nakafa graph content ID");
    expect(() =>
      Schema.decodeSync(NakafaAgentContentRefInputSchema)(
        "https://example.com/en/quran/1"
      )
    ).toThrow("Expected a Nakafa graph content ID");
    expect(() =>
      Schema.decodeSync(NakafaAgentContentRefInputSchema)(
        "nakafa://content/en%2Fquran%2F1"
      )
    ).toThrow("Expected a Nakafa graph content ID");
  });
});

describe("NakafaAgentMarkdownSchema", () => {
  it("requires the focused-read markdown URL", () => {
    const { markdown_url: _markdownUrl, ...reference } =
      readNakafaContentRefFixture(
        "en",
        "articles/politics/example",
        "articles"
      );

    expect(() =>
      Schema.decodeUnknownSync(NakafaAgentMarkdownSchema)({
        ...reference,
        description: "Example article.",
        text: "Article text.",
        title: "Example",
      })
    ).toThrow();
  });

  it("omits a description when signed metadata has none", () => {
    const reference = readNakafaContentRefFixture(
      "en",
      "material/mathematics/example",
      "material"
    );
    const decoded = Schema.decodeSync(NakafaAgentMarkdownSchema)({
      ...reference,
      text: "# Example",
      title: "Example",
    });

    expect(decoded).not.toHaveProperty("description");
  });
});
