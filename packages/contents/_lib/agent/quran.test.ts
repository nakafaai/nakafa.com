import { NakafaAgentInputError } from "@repo/contents/_lib/agent/errors";
import { getNakafaAgentQuranReference } from "@repo/contents/_lib/agent/quran";
import { Effect, Option } from "effect";
import { describe, expect, it, vi } from "vitest";

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
    expect(invalidInput).toBeInstanceOf(NakafaAgentInputError);
  });

  it("returns none when a valid Surah number is unavailable in the data source", async () => {
    vi.resetModules();
    vi.doMock("@repo/contents/_lib/quran", () => ({
      getSurah: () => Effect.fail(new Error("missing surah")),
      getSurahName: () => "Missing Surah",
    }));

    const { getNakafaAgentQuranReference } = await import(
      "@repo/contents/_lib/agent/quran"
    );
    const reference = await Effect.runPromise(
      getNakafaAgentQuranReference({
        from_verse: 1,
        locale: "en",
        surah: 1,
      })
    );

    expect(Option.isNone(reference)).toBe(true);
    vi.doUnmock("@repo/contents/_lib/quran");
    vi.resetModules();
  });

  it("returns none when Surah data has no verses in the requested range", async () => {
    vi.resetModules();
    vi.doMock("@repo/contents/_lib/quran", () => ({
      getSurah: () =>
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
            en: "Meccan",
            id: "Makkiyah",
          },
          sequence: 1,
          verses: [],
        }),
      getSurahName: () => "Empty",
    }));

    const { getNakafaAgentQuranReference } = await import(
      "@repo/contents/_lib/agent/quran"
    );
    const reference = await Effect.runPromise(
      getNakafaAgentQuranReference({
        from_verse: 1,
        locale: "en",
        surah: 1,
      })
    );

    expect(Option.isNone(reference)).toBe(true);
    vi.doUnmock("@repo/contents/_lib/quran");
    vi.resetModules();
  });
});
