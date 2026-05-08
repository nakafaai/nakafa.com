import { previewQuran } from "@repo/ai/agents/nakafa/preview";
import type { NakafaAgentQuranReference } from "@repo/contents/_lib/agent/schemas";
import { describe, expect, it } from "vitest";

describe("nakafa previews", () => {
  it("keeps Quran preview stable when a malformed result has no verses", () => {
    const result = {
      content_id: "en/quran/1",
      locale: "en",
      markdown_url: "https://nakafa.com/en/quran/1.md",
      name: "Al-Fatihah",
      revelation: "Mecca",
      route: "quran/1",
      section: "quran",
      translation: "The Opening",
      url: "https://nakafa.com/en/quran/1",
      verses: [],
    } satisfies NakafaAgentQuranReference;

    expect(previewQuran(result)).toMatchObject({
      from_verse: 1,
      to_verse: 1,
      verse_count: 0,
    });
  });
});
