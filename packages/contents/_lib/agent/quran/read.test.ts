import {
  NakafaAgentDataReadError,
  NakafaAgentInputError,
} from "@repo/contents/_lib/agent/errors";
import {
  decodeNakafaAgentQuranReference,
  getNakafaAgentQuranReference,
} from "@repo/contents/_lib/agent/quran/read";
import { buildNakafaContentRef } from "@repo/contents/_lib/agent/refs";
import { SurahNotFoundError } from "@repo/contents/_shared/error";
import { Effect, Option } from "effect";
import { describe, expect, it } from "vitest";

describe("Nakafa agent Quran references", () => {
  it("retrieves bounded Quran references and handles invalid bounds", async () => {
    const reference = await Effect.runPromise(
      getNakafaAgentQuranReference({
        from_verse: 1,
        include_tafsir: true,
        locale: "en",
        surah: 1,
        to_verse: 2,
      })
    );
    const reversed = await Effect.runPromise(
      getNakafaAgentQuranReference({
        from_verse: 3,
        locale: "en",
        surah: 1,
        to_verse: 2,
      })
    );
    const missingVerse = await Effect.runPromise(
      getNakafaAgentQuranReference({
        from_verse: 999,
        locale: "en",
        surah: 1,
      })
    );
    const outOfSurahRange = await Effect.runPromise(
      getNakafaAgentQuranReference({
        from_verse: 7,
        locale: "en",
        surah: 1,
        to_verse: 8,
      })
    );
    const invalidInput = await Effect.runPromise(
      Effect.match(
        getNakafaAgentQuranReference({
          from_verse: 1,
          locale: "en",
          surah: 999,
        }),
        {
          onFailure: (failure) => failure,
          onSuccess: () => null,
        }
      )
    );

    if (Option.isNone(reference)) {
      throw new Error("Expected Quran reference to exist.");
    }

    expect(reference.value.verses).toHaveLength(2);
    expect(reference.value.verses[0]?.tafsir).toBeTruthy();
    expect(Option.isNone(reversed)).toBe(true);
    expect(Option.isNone(missingVerse)).toBe(true);
    expect(Option.isNone(outOfSurahRange)).toBe(true);
    expect(invalidInput).toBeInstanceOf(NakafaAgentInputError);
  });

  it("returns none when a valid Surah number is unavailable in the data source", async () => {
    const reference = await Effect.runPromise(
      getNakafaAgentQuranReference(
        {
          from_verse: 1,
          locale: "en",
          surah: 1,
        },
        () =>
          Effect.fail(
            new SurahNotFoundError({
              message: "Surah was not found.",
              surahNumber: 1,
            })
          )
      )
    );

    expect(Option.isNone(reference)).toBe(true);
  });

  it("returns none when Surah data has no verses in the requested range", async () => {
    const reference = await Effect.runPromise(
      getNakafaAgentQuranReference(
        {
          from_verse: 1,
          locale: "en",
          surah: 1,
        },
        () =>
          Effect.succeed({
            name: {
              long: "Empty",
              short: "Empty",
              translation: {
                en: "Empty",
                id: "Kosong",
              },
              transliteration: {
                en: "Empty",
                id: "Kosong",
              },
            },
            number: 1,
            numberOfVerses: 1,
            revelation: {
              arab: "Meccan",
              en: "Meccan",
              id: "Makkiyah",
            },
            sequence: 1,
            verses: [],
          })
      )
    );

    expect(Option.isNone(reference)).toBe(true);
  });

  it("fails with a typed read error when the Quran reference schema rejects output", async () => {
    const error = await Effect.runPromise(
      Effect.match(
        decodeNakafaAgentQuranReference({
          ...buildNakafaContentRef("en", "quran/1", "quran"),
          name: "Al-Fatihah",
          revelation: "Meccan",
          translation: "The Opener",
          verses: [
            {
              arabic: "Invalid verse.",
              number: 0,
              translation:
                "In the Name of Allah, the Most Compassionate, Most Merciful.",
              transliteration: "Bismillahirrahmanirrahim",
            },
          ],
        }),
        {
          onFailure: (failure) => failure,
          onSuccess: () => null,
        }
      )
    );

    expect(error).toBeInstanceOf(NakafaAgentDataReadError);
  });
});
