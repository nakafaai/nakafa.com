import { ACTIVE_APP_LOCALE_CODES } from "@nakafa/aksara-contracts/locale";
import {
  decodeNakafaMarkdown,
  decodeNakafaQuranReference,
  decodeNakafaTaxonomy,
  parseQuranReferenceOptions,
} from "@repo/backend/client/nakafa/decode";
import {
  NakafaAgentDataReadError,
  NakafaAgentInputError,
} from "@repo/contents/_lib/agent/errors";
import { readNakafaContentRefFixture } from "@repo/contents/_lib/agent/fixture";
import { describe, expect, it } from "@repo/testing/effect";
import { Effect } from "effect";

const defaultLocale = ACTIVE_APP_LOCALE_CODES[0];

describe("Nakafa runtime decoders", () => {
  it.live("decodes valid agent-facing payloads", () =>
    Effect.gen(function* () {
      expect(yield* decodeNakafaMarkdown(markdown())).toMatchObject({
        locale: "en",
        text: "Body",
        title: "Title",
      });
      expect(yield* decodeNakafaQuranReference(quranReference())).toMatchObject(
        {
          route: "quran/1",
          verses: [{ number: 1 }],
        }
      );
      expect(yield* decodeNakafaTaxonomy(taxonomy())).toMatchObject({
        default_locale: "en",
        quran: { surah_count: 114 },
      });
      expect(
        yield* parseQuranReferenceOptions({
          from_verse: 1,
          include_tafsir: true,
          locale: "id",
          surah: 1,
          to_verse: 2,
        })
      ).toMatchObject({
        include_tafsir: true,
        locale: "id",
      });
    })
  );
  it.live("maps invalid output and input into typed Nakafa errors", () =>
    Effect.gen(function* () {
      yield* expectDecodeError(
        decodeNakafaMarkdown({}),
        NakafaAgentDataReadError
      );
      yield* expectDecodeError(
        decodeNakafaQuranReference({}),
        NakafaAgentDataReadError
      );
      yield* expectDecodeError(
        decodeNakafaTaxonomy({}),
        NakafaAgentDataReadError
      );
      yield* expectDecodeError(
        parseQuranReferenceOptions({ surah: "one" }),
        NakafaAgentInputError
      );
    })
  );
});
/** Expects one decoding effect to fail with the supplied typed error class. */
function expectDecodeError(
  effect: Effect.Effect<unknown, unknown>,
  expectedError: new (...args: never[]) => Error
) {
  return Effect.gen(function* () {
    const result = yield* Effect.result(effect);
    expect(result._tag).toBe("Failure");
    if (result._tag === "Failure") {
      expect(result.failure).toBeInstanceOf(expectedError);
    }
  });
}
/** Builds a minimal valid markdown payload for schema decoding. */
function markdown() {
  return {
    ...readNakafaContentRefFixture(
      "en",
      "articles/politics/example",
      "articles"
    ),
    description: "Description",
    text: "Body",
    title: "Title",
  };
}
/** Builds a minimal valid Quran reference payload for schema decoding. */
function quranReference() {
  return {
    ...readNakafaContentRefFixture("en", "quran/1", "quran"),
    name: "Al-Faatiha",
    revelation: "Mecca",
    translation: "The Opening",
    verses: [
      {
        arabic: "بِسْمِ اللّٰهِ الرَّحْمٰنِ الرَّحِيْمِ",
        number: 1,
        translation: "In the name of Allah.",
      },
    ],
  };
}
/** Builds a minimal valid taxonomy payload for schema decoding. */
function taxonomy() {
  return {
    articles: { categories: ["general"] },
    content_counts: [
      {
        count: 1,
        locale: "en",
      },
    ],
    default_locale: defaultLocale,
    endpoints: {
      mcp: "https://mcp.nakafa.com/mcp",
    },
    locale: "en",
    locales: Array.from(ACTIVE_APP_LOCALE_CODES),
    quran: { surah_count: 114 },
    sections: ["articles", "material", "quran"],
    tryout: {
      countries: [{ id: "indonesia", label: "Indonesia" }],
      exams: [{ id: "snbt", label: "SNBT" }],
    },
    tools: ["nakafa_search_content"],
  };
}
