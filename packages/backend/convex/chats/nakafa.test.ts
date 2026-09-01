import { describe, expect, it } from "@effect/vitest";
import { nakafaDataValidator } from "@repo/backend/convex/chats/nakafa";
import { readNakafaContentRefFixture } from "@repo/contents/_lib/agent/fixture";
import { validate } from "convex-helpers/validators";

const quranRef = readNakafaContentRefFixture("en", "quran/1", "quran");
const input = {
  from_verse: 1,
  include_tafsir: false,
  locale: "en",
  surah: 1,
  to_verse: 1,
};
const preview = {
  ...quranRef,
  from_verse: 1,
  name: "Al-Fatihah",
  revelation: "Mecca",
  to_verse: 1,
  verse_count: 1,
};

describe("Nakafa chat data schema", () => {
  it("persists canonical Quran previews", () => {
    expect(
      validate(nakafaDataValidator, {
        input,
        kind: "quran",
        result: {
          ...preview,
          meaning: {
            locale: "en",
            text: "The Opening",
          },
        },
        status: "done",
      })
    ).toBe(true);

    expect(
      validate(nakafaDataValidator, {
        input: { ...input, locale: "id" },
        kind: "quran",
        result: {
          ...preview,
          locale: "id",
          meaning: { locale: "en", text: "The Opening" },
        },
        status: "done",
      })
    ).toBe(true);
  });

  it("rejects uncorrelated Quran preview locales", () => {
    expect(
      validate(nakafaDataValidator, {
        input: { ...input, locale: "id" },
        kind: "quran",
        result: {
          ...preview,
          locale: "id",
          meaning: { locale: "de", text: "Die Eröffnende" },
        },
        status: "done",
      })
    ).toBe(false);
    expect(
      validate(nakafaDataValidator, {
        input: { ...input, locale: "id" },
        kind: "quran",
        result: {
          ...preview,
          locale: "de",
          meaning: { locale: "en", text: "The Opening" },
        },
        status: "done",
      })
    ).toBe(false);
  });

  it("preserves persisted translation-only Quran previews", () => {
    expect(
      validate(nakafaDataValidator, {
        input,
        kind: "quran",
        result: {
          ...preview,
          translation: "The Opening",
        },
        status: "done",
      })
    ).toBe(true);
  });

  it("rejects previews with canonical and obsolete fields", () => {
    expect(
      validate(nakafaDataValidator, {
        input,
        kind: "quran",
        result: {
          ...preview,
          meaning: {
            locale: "en",
            text: "The Opening",
          },
          translation: "The Opening",
        },
        status: "done",
      })
    ).toBe(false);
  });
});
