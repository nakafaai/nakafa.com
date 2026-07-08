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
import { defaultLocale, locales } from "@repo/utilities/locales";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

describe("Nakafa runtime decoders", () => {
  it("decodes valid agent-facing payloads", async () => {
    await expect(
      Effect.runPromise(decodeNakafaMarkdown(markdown()))
    ).resolves.toMatchObject({
      locale: "en",
      text: "Body",
      title: "Title",
    });
    await expect(
      Effect.runPromise(decodeNakafaQuranReference(quranReference()))
    ).resolves.toMatchObject({
      route: "quran/1",
      verses: [{ number: 1 }],
    });
    await expect(
      Effect.runPromise(decodeNakafaTaxonomy(taxonomy()))
    ).resolves.toMatchObject({
      default_locale: "en",
      quran: { surah_count: 114 },
    });
    await expect(
      Effect.runPromise(
        parseQuranReferenceOptions({
          from_verse: 1,
          include_tafsir: true,
          locale: "id",
          surah: 1,
          to_verse: 2,
        })
      )
    ).resolves.toMatchObject({
      include_tafsir: true,
      locale: "id",
    });
  });

  it("maps invalid output and input into typed Nakafa errors", async () => {
    await expectDecodeError(decodeNakafaMarkdown({}), NakafaAgentDataReadError);
    await expectDecodeError(
      decodeNakafaQuranReference({}),
      NakafaAgentDataReadError
    );
    await expectDecodeError(decodeNakafaTaxonomy({}), NakafaAgentDataReadError);
    await expectDecodeError(
      parseQuranReferenceOptions({ surah: "one" }),
      NakafaAgentInputError
    );
  });
});

/** Expects one decoding effect to fail with the supplied typed error class. */
async function expectDecodeError(
  effect: Effect.Effect<unknown, unknown>,
  expectedError: new (...args: never[]) => Error
) {
  const result = await Effect.runPromise(Effect.either(effect));

  expect(result._tag).toBe("Left");

  if (result._tag === "Left") {
    expect(result.left).toBeInstanceOf(expectedError);
  }
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
        transliteration: "Bismillahirrahmanirrahim",
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
      direct: "https://mcp.nakafa.com/mcp",
      recommended: "https://nakafa.com/mcp",
      root_note: "Root is informational only.",
    },
    locale: "en",
    locales: Array.from(locales),
    quran: { surah_count: 114 },
    sections: ["articles", "material", "quran"],
    subject: {
      categories: ["high-school"],
      grades: ["10"],
      materials: ["mathematics"],
    },
    tryout: {
      countries: [{ id: "indonesia", label: "Indonesia" }],
      exams: [{ id: "snbt", label: "SNBT" }],
    },
    tools: ["nakafa_search_content"],
  };
}
