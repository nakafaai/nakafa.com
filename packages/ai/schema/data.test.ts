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
  it("decodes only the canonical source-grounded preview", () => {
    const canonical = {
      ...common,
      result: { ...preview, meaning: { locale: "en", text: "The Opening" } },
    };

    expect(Schema.is(NakafaDataSchema)(canonical)).toBe(true);
    expect(
      Schema.is(NakafaDataSchema)({
        ...common,
        input: { ...common.input, locale: "id" },
        result: {
          ...preview,
          locale: "id",
          meaning: { locale: "id", text: "Pembuka" },
        },
      })
    ).toBe(true);
    expect(
      Schema.is(NakafaDataSchema)({
        ...common,
        result: { ...preview, translation: "The Opening" },
      })
    ).toBe(false);
    expect(
      Schema.is(NakafaDataSchema)({
        ...common,
        result: preview,
      })
    ).toBe(false);
  });
});
