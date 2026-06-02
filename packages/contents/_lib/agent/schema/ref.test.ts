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
  it("rejects unsupported locales and unsafe routes", () => {
    expect(() =>
      Schema.decodeUnknownSync(NakafaAgentContentIdSchema)("xx/quran/1")
    ).toThrow(
      "Expected a locale-prefixed Nakafa content ID with a safe route."
    );

    expect(() =>
      Schema.decodeUnknownSync(NakafaAgentContentIdSchema)("en/quran/../1")
    ).toThrow(
      "Expected a locale-prefixed Nakafa content ID with a safe route."
    );

    expect(() =>
      Schema.decodeUnknownSync(NakafaAgentContentIdSchema)("en")
    ).toThrow(
      "Expected a locale-prefixed Nakafa content ID with a safe route."
    );
  });
});

describe("NakafaAgentContentRouteSchema", () => {
  it("rejects empty and unsafe routes", () => {
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
  it("accepts canonical Nakafa hosts and rejects noncanonical URLs", () => {
    expect(
      Schema.decodeUnknownSync(NakafaAgentContentUrlSchema)(
        "https://www.nakafa.com/en/quran/1"
      )
    ).toBe("https://www.nakafa.com/en/quran/1");

    expect(() =>
      Schema.decodeUnknownSync(NakafaAgentContentUrlSchema)(
        "http://nakafa.com/en/quran/1"
      )
    ).toThrow("Expected a canonical Nakafa content URL.");
  });
});

describe("NakafaAgentMarkdownUrlSchema", () => {
  it("accepts markdown URLs and rejects non-markdown content URLs", () => {
    expect(
      Schema.decodeUnknownSync(NakafaAgentMarkdownUrlSchema)(
        "https://nakafa.com/en/quran/1.md"
      )
    ).toBe("https://nakafa.com/en/quran/1.md");

    expect(() =>
      Schema.decodeUnknownSync(NakafaAgentMarkdownUrlSchema)(
        "https://nakafa.com/en/quran/1"
      )
    ).toThrow("Expected a canonical Nakafa markdown URL.");
  });
});

describe("NakafaAgentContentRefSchema", () => {
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
