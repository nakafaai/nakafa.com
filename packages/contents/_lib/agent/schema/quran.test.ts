import { readNakafaContentRefFixture } from "@repo/contents/_lib/agent/fixture";
import {
  NakafaAgentQuranReferenceOptionsSchema,
  NakafaAgentQuranReferenceSchema,
} from "@repo/contents/_lib/agent/schema/quran";
import { Schema } from "effect";
import { describe, expect, it } from "vitest";

describe("NakafaAgentQuranReferenceOptionsSchema", () => {
  it("applies default Quran options", () => {
    expect(
      Schema.decodeSync(NakafaAgentQuranReferenceOptionsSchema)({
        surah: 1,
      })
    ).toMatchObject({
      from_verse: 1,
      include_tafsir: false,
      locale: "en",
      surah: 1,
    });
  });

  it("requires the published surah markdown URL", () => {
    const { markdown_url: _markdownUrl, ...reference } =
      readNakafaContentRefFixture("en", "quran/1", "quran");

    expect(() =>
      Schema.decodeUnknownSync(NakafaAgentQuranReferenceSchema)({
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
