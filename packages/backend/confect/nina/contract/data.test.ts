import { describe, expect, it } from "@effect/vitest";
import {
  DataPartSchema,
  NakafaDataSchema,
} from "@repo/backend/confect/nina/contract/data";
import { webSearchQueryMaxLength } from "@repo/backend/confect/nina/research/schema";
import { NAKAFA_AGENT_MAX_QUERY_LENGTH } from "@repo/contents/agent/search";
import { readNakafaContentRefFixture } from "@repo/contents/test/fixture";
import { Result, Schema } from "effect";

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
        input: { ...common.input, locale: "id" },
        result: {
          ...preview,
          locale: "id",
          meaning: { locale: "en", text: "The Opening" },
        },
      })
    ).toBe(true);
    expect(
      Schema.is(NakafaDataSchema)({
        ...common,
        input: { ...common.input, locale: "id" },
        result: {
          ...preview,
          locale: "id",
          meaning: { locale: "de", text: "Die Eröffnende" },
        },
      })
    ).toBe(false);
    expect(
      Schema.is(NakafaDataSchema)({
        ...common,
        input: { ...common.input, locale: "id" },
        result: {
          ...preview,
          locale: "de",
          meaning: { locale: "en", text: "The Opening" },
        },
      })
    ).toBe(false);
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

describe("persisted search queries", () => {
  it("keeps a query longer than a new search may send readable", () => {
    const nakafa = "a".repeat(NAKAFA_AGENT_MAX_QUERY_LENGTH + 1);
    const web = "a".repeat(webSearchQueryMaxLength + 1);

    // The recorded input decodes with no limit on the text a query was written in.
    expect(
      Result.isSuccess(
        Schema.decodeResult(NakafaDataSchema)({
          input: { limit: 10, locale: "en", offset: 0, queries: [nakafa] },
          kind: "search",
          status: "loading",
        })
      )
    ).toBe(true);
    expect(
      Result.isSuccess(
        Schema.decodeResult(DataPartSchema.fields["web-search"])({
          provider: "firecrawl",
          queries: [web],
          sources: [],
          status: "done",
        })
      )
    ).toBe(true);
  });
});
