import { readNakafaContentRefFixture } from "@repo/contents/_lib/agent/fixture";
import { NakafaAgentQuranReferenceSchema } from "@repo/contents/_lib/agent/schema/quran";
import { describe, expect, it } from "@repo/testing/effect";
import { Effect, Schema } from "effect";
import { vi } from "vitest";
import { getNakafaQuranReferenceToolResult } from "@/lib/mcp/tools/quran";

vi.mock("@/lib/mcp/nakafa", async () => {
  const { Effect, Option } = await import("effect");

  return {
    nakafaContent: {
      /** Returns deterministic Quran references for MCP result shaping tests. */
      quran: (input: { from_verse: number; include_tafsir: boolean }) => {
        if (input.from_verse === 999) {
          return Effect.succeed(Option.none());
        }

        return Effect.succeed(
          Option.some({
            ...readNakafaContentRefFixture("en", "quran/1", "quran"),
            name: "Al-Faatiha",
            revelation: "Mecca",
            translation: "The Opening",
            verses: [
              {
                arabic: "بِسْمِ اللّٰهِ الرَّحْمٰنِ الرَّحِيْمِ",
                number: 1,
                ...(input.include_tafsir ? { tafsir: "Tafsir" } : {}),
                translation: "In the name of Allah.",
              },
              {
                arabic: "الْحَمْدُ لِلّٰهِ رَبِّ الْعٰلَمِيْنَ",
                number: 2,
                ...(input.include_tafsir ? { tafsir: "Tafsir" } : {}),
                translation: "All praise is for Allah.",
              },
            ],
          })
        );
      },
    },
  };
});

const ToolErrorResultSchema = Schema.Struct({
  isError: Schema.Literal(true),
  structuredContent: Schema.Struct({
    error: Schema.Struct({
      message: Schema.String,
      suggestions: Schema.NonEmptyArray(Schema.String),
    }),
  }),
});

describe("nakafa_get_quran_reference", () => {
  it.live("returns structured Quran references", () =>
    Effect.gen(function* () {
      const result = yield* getNakafaQuranReferenceToolResult({
        from_verse: 1,
        include_tafsir: true,
        locale: "en",
        surah: 1,
        to_verse: 2,
      });
      const reference = yield* Schema.decodeUnknownEffect(
        NakafaAgentQuranReferenceSchema
      )(result.structuredContent);

      expect(result.isError).not.toBe(true);
      expect(reference.content_id).toBe(
        readNakafaContentRefFixture("en", "quran/1", "quran").content_id
      );
      expect(reference.verses).toHaveLength(2);
      expect(reference.verses[0].tafsir).toBeTruthy();
    })
  );

  it.live("returns structured read-model input errors", () =>
    Effect.gen(function* () {
      const result = yield* getNakafaQuranReferenceToolResult({
        from_verse: 1,
        include_tafsir: false,
        locale: "en",
        surah: 999,
      });
      const error = yield* Schema.decodeUnknownEffect(ToolErrorResultSchema)(
        result
      );

      expect(error.structuredContent.error).toStrictEqual({
        message: "Invalid Nakafa Quran reference options.",
        suggestions: [expect.stringContaining("Surah number")],
      });
    })
  );

  it.live("returns structured range and missing-reference errors", () =>
    Effect.gen(function* () {
      const reversed = yield* getNakafaQuranReferenceToolResult({
        from_verse: 3,
        locale: "en",
        surah: 1,
        to_verse: 2,
      });
      const large = yield* getNakafaQuranReferenceToolResult({
        from_verse: 1,
        locale: "en",
        surah: 2,
        to_verse: 30,
      });
      const missing = yield* getNakafaQuranReferenceToolResult({
        from_verse: 999,
        locale: "en",
        surah: 1,
      });
      const [reversedError, largeError, missingError] = yield* Effect.all([
        Schema.decodeUnknownEffect(ToolErrorResultSchema)(reversed),
        Schema.decodeUnknownEffect(ToolErrorResultSchema)(large),
        Schema.decodeUnknownEffect(ToolErrorResultSchema)(missing),
      ]);

      expect(reversedError.structuredContent.error.message).toBe(
        "Invalid Quran verse range."
      );
      expect(largeError.structuredContent.error.message).toBe(
        "Quran reference range is too large."
      );
      expect(missingError.structuredContent.error.message).toBe(
        "Nakafa Quran reference was not found."
      );
    })
  );
});
