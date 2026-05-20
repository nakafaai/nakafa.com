import {
  NakafaAgentContentRefSchema,
  NakafaAgentContentSummarySchema,
} from "@repo/contents/_lib/agent/schema/ref";
import { Schema } from "effect";
import { describe, expect, it } from "vitest";

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
