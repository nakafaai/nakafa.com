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

describe("NakafaAgentContentIdSchema", () => {
  it("accepts locale-prefixed content IDs with a safe route", () => {
    expect(
      Schema.decodeUnknownSync(NakafaAgentContentIdSchema)("en/quran/1")
    ).toBe("en/quran/1");
  });

  it("rejects content IDs without a supported locale or safe route", () => {
    expect(() =>
      Schema.decodeUnknownSync(NakafaAgentContentIdSchema)("xx/quran/1")
    ).toThrow("Expected a locale-prefixed Nakafa content ID");

    expect(() =>
      Schema.decodeUnknownSync(NakafaAgentContentIdSchema)("quran/1")
    ).toThrow("Expected a locale-prefixed Nakafa content ID");

    expect(() =>
      Schema.decodeUnknownSync(NakafaAgentContentIdSchema)("en")
    ).toThrow("Expected a locale-prefixed Nakafa content ID");

    expect(() =>
      Schema.decodeUnknownSync(NakafaAgentContentIdSchema)("en/quran/../1")
    ).toThrow("Expected a locale-prefixed Nakafa content ID");
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
  });
});

describe("NakafaAgentContentRefSchema", () => {
  it("accepts canonical content references", () => {
    const ref = {
      content_id: "en/quran/1",
      locale: "en",
      markdown_url: "https://nakafa.com/en/quran/1.md",
      route: "quran/1",
      section: "quran",
      url: "https://nakafa.com/en/quran/1",
    };

    expect(Schema.decodeUnknownSync(NakafaAgentContentRefSchema)(ref)).toEqual(
      ref
    );
  });

  it("rejects invalid canonical URLs", () => {
    expect(() =>
      Schema.decodeUnknownSync(NakafaAgentContentRefSchema)({
        content_id: "en/quran/1",
        locale: "en",
        markdown_url: "not-a-url",
        route: "quran/1",
        section: "quran",
        url: "https://nakafa.com/en/quran/1",
      })
    ).toThrow("Expected a valid URL.");
  });
});

describe("NakafaAgentContentSummarySchema", () => {
  it("accepts searchable content summaries", () => {
    const summary = {
      content_id: "en/quran/1",
      description: "Al-Fatihah",
      locale: "en",
      markdown_url: "https://nakafa.com/en/quran/1.md",
      route: "quran/1",
      section: "quran",
      title: "Al-Fatihah",
      url: "https://nakafa.com/en/quran/1",
    };

    expect(
      Schema.decodeUnknownSync(NakafaAgentContentSummarySchema)(summary)
    ).toEqual(summary);
  });

  it("rejects invalid canonical URLs", () => {
    expect(() =>
      Schema.decodeUnknownSync(NakafaAgentContentSummarySchema)({
        content_id: "en/quran/1",
        description: "Al-Fatihah",
        locale: "en",
        markdown_url: "https://nakafa.com/en/quran/1.md",
        route: "quran/1",
        section: "quran",
        title: "Al-Fatihah",
        url: "not-a-url",
      })
    ).toThrow("Expected a valid URL.");
  });
});
