import { buildNakafaContentRef } from "@repo/contents/_lib/agent/refs";
import {
  NakafaAgentContentIdSchema,
  NakafaAgentContentRefSchema,
  NakafaAgentContentRouteSchema,
  NakafaAgentContentSummarySchema,
  NakafaAgentContentUrlSchema,
  NakafaAgentMarkdownUrlSchema,
} from "@repo/contents/_lib/agent/schema/ref";
import { createLearningGraphIdentity } from "@repo/contents/_types/learning-graph";
import { Schema } from "effect";
import { describe, expect, it } from "vitest";

const quranIdentity = createLearningGraphIdentity({
  kind: "quran-surah",
  locale: "en",
  route: "quran/1",
});
const quranRef = {
  ...quranIdentity,
  content_id: quranIdentity.assetId,
  locale: "en",
  markdown_url: "https://nakafa.com/en/quran/1.md",
  route: "quran/1",
  section: "quran",
  url: "https://nakafa.com/en/quran/1",
};

describe("NakafaAgentContentIdSchema", () => {
  it("accepts graph-backed asset content IDs", () => {
    expect(
      Schema.decodeUnknownSync(NakafaAgentContentIdSchema)(
        quranIdentity.assetId
      )
    ).toBe(quranIdentity.assetId);
  });

  it("rejects non-asset and unsafe content IDs", () => {
    expect(() =>
      Schema.decodeUnknownSync(NakafaAgentContentIdSchema)("en/quran/1")
    ).toThrow("Expected a graph-backed Nakafa asset content ID.");

    expect(() =>
      Schema.decodeUnknownSync(NakafaAgentContentIdSchema)("asset:id")
    ).toThrow("Expected a graph-backed Nakafa asset content ID.");

    expect(() =>
      Schema.decodeUnknownSync(NakafaAgentContentIdSchema)(
        "route:id:quran-surah:1"
      )
    ).toThrow("Expected a graph-backed Nakafa asset content ID.");

    expect(() =>
      Schema.decodeUnknownSync(NakafaAgentContentIdSchema)(
        "asset:id:quran/../1"
      )
    ).toThrow("Expected a graph-backed Nakafa asset content ID.");
  });
});

describe("NakafaAgentContentRouteSchema", () => {
  it("accepts locale-free safe routes", () => {
    expect(
      Schema.decodeUnknownSync(NakafaAgentContentRouteSchema)("quran/1")
    ).toBe("quran/1");
  });

  it("rejects empty or unsafe routes", () => {
    expect(() =>
      Schema.decodeUnknownSync(NakafaAgentContentRouteSchema)("")
    ).toThrow("Expected a safe locale-free Nakafa content route.");

    expect(() =>
      Schema.decodeUnknownSync(NakafaAgentContentRouteSchema)("quran//1")
    ).toThrow("Expected a safe locale-free Nakafa content route.");

    expect(() =>
      Schema.decodeUnknownSync(NakafaAgentContentRouteSchema)("quran/../1")
    ).toThrow("Expected a safe locale-free Nakafa content route.");
  });
});

describe("NakafaAgentContentUrlSchema", () => {
  it("accepts canonical Nakafa content URLs", () => {
    expect(
      Schema.decodeUnknownSync(NakafaAgentContentUrlSchema)(
        "https://www.nakafa.com/en/quran/1"
      )
    ).toBe("https://www.nakafa.com/en/quran/1");

    expect(
      Schema.decodeUnknownSync(NakafaAgentContentUrlSchema)(
        "https://nakafa.com"
      )
    ).toBe("https://nakafa.com");
  });

  it("rejects non-canonical content URLs", () => {
    expect(() =>
      Schema.decodeUnknownSync(NakafaAgentContentUrlSchema)(
        "http://nakafa.com/en/quran/1"
      )
    ).toThrow("Expected a canonical Nakafa content URL.");

    expect(() =>
      Schema.decodeUnknownSync(NakafaAgentContentUrlSchema)(
        "https://example.com/en/quran/1"
      )
    ).toThrow("Expected a canonical Nakafa content URL.");
  });
});

describe("NakafaAgentMarkdownUrlSchema", () => {
  it("accepts canonical markdown URLs", () => {
    expect(
      Schema.decodeUnknownSync(NakafaAgentMarkdownUrlSchema)(
        "https://nakafa.com/en/quran/1.md"
      )
    ).toBe("https://nakafa.com/en/quran/1.md");
  });

  it("rejects canonical URLs without a markdown extension", () => {
    expect(() =>
      Schema.decodeUnknownSync(NakafaAgentMarkdownUrlSchema)(
        "https://nakafa.com/en/quran/1"
      )
    ).toThrow("Expected a canonical Nakafa markdown URL.");

    expect(() =>
      Schema.decodeUnknownSync(NakafaAgentMarkdownUrlSchema)(
        "https://example.com/en/quran/1.md"
      )
    ).toThrow("Expected a canonical Nakafa markdown URL.");
  });
});

describe("NakafaAgentContentRefSchema", () => {
  it("accepts canonical content references", () => {
    expect(
      Schema.decodeUnknownSync(NakafaAgentContentRefSchema)(quranRef)
    ).toEqual(quranRef);
  });

  it("rejects refs that cannot become graph identity", () => {
    expect(() =>
      buildNakafaContentRef("en", "articles/example", "articles")
    ).toThrow("Cannot build Nakafa graph content ref");
  });

  it("rejects invalid canonical URLs", () => {
    expect(() =>
      Schema.decodeUnknownSync(NakafaAgentContentRefSchema)({
        ...quranRef,
        markdown_url: "not-a-url",
      })
    ).toThrow("Expected a valid URL.");
  });

  it("rejects unsafe graph IDs in content references", () => {
    expect(() =>
      Schema.decodeUnknownSync(NakafaAgentContentRefSchema)({
        ...quranRef,
        conceptId: "concept",
      })
    ).toThrow("Expected a safe Nakafa graph ID.");
  });
});

describe("NakafaAgentContentSummarySchema", () => {
  it("accepts searchable content summaries", () => {
    const summary = {
      ...quranRef,
      description: "Al-Fatihah",
      title: "Al-Fatihah",
    };

    expect(
      Schema.decodeUnknownSync(NakafaAgentContentSummarySchema)(summary)
    ).toEqual(summary);
  });

  it("rejects invalid canonical URLs", () => {
    expect(() =>
      Schema.decodeUnknownSync(NakafaAgentContentSummarySchema)({
        ...quranRef,
        description: "Al-Fatihah",
        title: "Al-Fatihah",
        url: "not-a-url",
      })
    ).toThrow("Expected a valid URL.");
  });
});
