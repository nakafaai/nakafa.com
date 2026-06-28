import { previewQuran } from "@repo/ai/agents/nakafa/preview";
import { readNakafaContentRefFixture } from "@repo/contents/_lib/agent/fixture";
import type { NakafaAgentQuranReference } from "@repo/contents/_lib/agent/schema/quran";
import { describe, expect, it } from "vitest";

describe("nakafa previews", () => {
  it("keeps Quran preview stable when a malformed result has no verses", () => {
    const result = {
      ...readNakafaContentRefFixture("en", "quran/1", "quran"),
      name: "Al-Fatihah",
      revelation: "Mecca",
      translation: "The Opening",
      verses: [],
    } satisfies NakafaAgentQuranReference;

    expect(previewQuran(result)).toMatchObject({
      from_verse: 1,
      to_verse: 1,
      verse_count: 0,
    });
  });
});
