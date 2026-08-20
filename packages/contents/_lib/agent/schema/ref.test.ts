import { readNakafaContentRefFixture } from "@repo/contents/_lib/agent/fixture";
import {
  NakafaAgentContentIdSchema,
  NakafaAgentContentRefSchema,
  NakafaAgentContentRouteSchema,
  NakafaAgentContentSummarySchema,
  NakafaAgentContentUrlSchema,
  NakafaAgentMarkdownUrlSchema,
} from "@repo/contents/_lib/agent/schema/ref";
import { Schema } from "effect";
import { describe, expect, it } from "vitest";

const quranRef = readNakafaContentRefFixture("en", "quran/1", "quran");

describe("NakafaAgentContentIdSchema", () => {
  it("accepts graph-backed asset content IDs", () => {
    expect(
      Schema.decodeSync(NakafaAgentContentIdSchema)(quranRef.content_id)
    ).toBe(quranRef.content_id);
  });

  it("rejects non-asset and unsafe content IDs", () => {
    expect(() =>
      Schema.decodeSync(NakafaAgentContentIdSchema)("en/quran/1")
    ).toThrow("Expected a graph-backed Nakafa asset content ID.");

    expect(() =>
      Schema.decodeSync(NakafaAgentContentIdSchema)("asset:id")
    ).toThrow("Expected a graph-backed Nakafa asset content ID.");

    expect(() =>
      Schema.decodeSync(NakafaAgentContentIdSchema)("route:id:quran-surah:1")
    ).toThrow("Expected a graph-backed Nakafa asset content ID.");

    expect(() =>
      Schema.decodeSync(NakafaAgentContentIdSchema)("asset:id:quran/../1")
    ).toThrow("Expected a graph-backed Nakafa asset content ID.");
  });
});

describe("NakafaAgentContentRouteSchema", () => {
  it("accepts locale-free safe routes", () => {
    expect(Schema.decodeSync(NakafaAgentContentRouteSchema)("quran/1")).toBe(
      "quran/1"
    );
  });

  it("rejects empty or unsafe routes", () => {
    expect(() => Schema.decodeSync(NakafaAgentContentRouteSchema)("")).toThrow(
      "Expected a safe locale-free Nakafa content route."
    );

    expect(() =>
      Schema.decodeSync(NakafaAgentContentRouteSchema)("quran//1")
    ).toThrow("Expected a safe locale-free Nakafa content route.");

    expect(() =>
      Schema.decodeSync(NakafaAgentContentRouteSchema)("quran/../1")
    ).toThrow("Expected a safe locale-free Nakafa content route.");
  });
});

describe("NakafaAgentContentUrlSchema", () => {
  it("accepts canonical Nakafa content URLs", () => {
    expect(
      Schema.decodeSync(NakafaAgentContentUrlSchema)(
        "https://www.nakafa.com/en/quran/1"
      )
    ).toBe("https://www.nakafa.com/en/quran/1");

    expect(
      Schema.decodeSync(NakafaAgentContentUrlSchema)("https://nakafa.com")
    ).toBe("https://nakafa.com");
  });

  it("rejects non-canonical content URLs", () => {
    expect(() =>
      Schema.decodeSync(NakafaAgentContentUrlSchema)(
        "http://nakafa.com/en/quran/1"
      )
    ).toThrow("Expected a canonical Nakafa content URL.");

    expect(() =>
      Schema.decodeSync(NakafaAgentContentUrlSchema)(
        "https://example.com/en/quran/1"
      )
    ).toThrow("Expected a canonical Nakafa content URL.");
  });
});

describe("NakafaAgentMarkdownUrlSchema", () => {
  it("accepts canonical markdown URLs", () => {
    expect(
      Schema.decodeSync(NakafaAgentMarkdownUrlSchema)(
        "https://nakafa.com/en/quran/1.md"
      )
    ).toBe("https://nakafa.com/en/quran/1.md");
  });

  it("rejects canonical URLs without a markdown extension", () => {
    expect(() =>
      Schema.decodeSync(NakafaAgentMarkdownUrlSchema)(
        "https://nakafa.com/en/quran/1"
      )
    ).toThrow("Expected a canonical Nakafa markdown URL.");

    expect(() =>
      Schema.decodeSync(NakafaAgentMarkdownUrlSchema)(
        "https://example.com/en/quran/1.md"
      )
    ).toThrow("Expected a canonical Nakafa markdown URL.");
  });
});

describe("NakafaAgentContentRefSchema", () => {
  it("accepts canonical content references", () => {
    expect(Schema.decodeSync(NakafaAgentContentRefSchema)(quranRef)).toEqual(
      quranRef
    );
  });

  it("rejects invalid canonical URLs", () => {
    expect(() =>
      Schema.decodeSync(NakafaAgentContentRefSchema)({
        ...quranRef,
        markdown_url: "not-a-url",
      })
    ).toThrow("Expected a valid URL.");
  });

  it("allows content families without a markdown reader", () => {
    const reference = readNakafaContentRefFixture(
      "en",
      "try-out/indonesia/snbt/2027/set-1/general-reasoning",
      "tryout"
    );

    expect(Schema.decodeSync(NakafaAgentContentRefSchema)(reference)).toEqual(
      reference
    );
    expect(reference.markdown_url).toBeUndefined();
  });

  it("rejects unsafe graph IDs in content references", () => {
    expect(() =>
      Schema.decodeSync(NakafaAgentContentRefSchema)({
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

    expect(Schema.decodeSync(NakafaAgentContentSummarySchema)(summary)).toEqual(
      summary
    );
  });

  it("rejects invalid canonical URLs", () => {
    expect(() =>
      Schema.decodeSync(NakafaAgentContentSummarySchema)({
        ...quranRef,
        description: "Al-Fatihah",
        title: "Al-Fatihah",
        url: "not-a-url",
      })
    ).toThrow("Expected a valid URL.");
  });
});
