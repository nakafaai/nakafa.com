import { readNakafaContentRefFixture } from "@repo/contents/_lib/agent/fixture";
import { NakafaAgentQuranPredecessorSchema } from "@repo/contents/_lib/agent/schema/quran/predecessor";
import { Schema } from "effect";
import { describe, expect, it } from "vitest";

describe("NakafaAgentQuranPredecessorSchema", () => {
  it("requires the published surah markdown URL", () => {
    const { markdown_url: _markdownUrl, ...reference } =
      readNakafaContentRefFixture("en", "quran/1", "quran");

    expect(() =>
      Schema.decodeUnknownSync(NakafaAgentQuranPredecessorSchema)({
        ...reference,
        name: "Al-Fatihah",
        revelation: "Mecca",
        translation: "The Opening",
        verses: [
          {
            arabic: "بِسْمِ اللَّهِ",
            number: 1,
            translation: "In the name of Allah.",
          },
        ],
      })
    ).toThrow();
  });
});
