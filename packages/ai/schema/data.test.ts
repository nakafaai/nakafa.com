import { NakafaDataSchema } from "@repo/ai/schema/data";
import { readNakafaContentRefFixture } from "@repo/contents/_lib/agent/fixture";
import { Schema } from "effect";
import { describe, expect, it } from "vitest";

const ref = readNakafaContentRefFixture("en", "quran/1", "quran");
const common = {
  input: {
    from_verse: 1,
    include_tafsir: false,
    locale: "en",
    surah: 1,
  },
  kind: "quran",
  status: "done",
} as const;
const preview = {
  ...ref,
  from_verse: 1,
  name: "Al-Fatihah",
  revelation: "Mecca",
  to_verse: 1,
  verse_count: 1,
};

describe("Nakafa persisted Quran data", () => {
  it("decodes both legacy and source-grounded V2 previews", () => {
    const legacy = {
      ...common,
      result: { ...preview, translation: "The Opening" },
    };
    const v2 = {
      ...common,
      result: { ...preview, meaning: { locale: "en", text: "The Opening" } },
    };

    expect(Schema.is(NakafaDataSchema)(legacy)).toBe(true);
    expect(Schema.is(NakafaDataSchema)(v2)).toBe(true);
    expect(
      Schema.is(NakafaDataSchema)({
        ...common,
        result: preview,
      })
    ).toBe(false);
  });
});
