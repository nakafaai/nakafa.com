import { buildNakafaContentRef } from "@repo/contents/_lib/agent/refs";
import { NakafaAgentQuranReferenceSchema } from "@repo/contents/_lib/agent/schema/quran";
import { Effect, Schema } from "effect";
import { describe, expect, it, vi } from "vitest";
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
            ...buildNakafaContentRef("en", "quran/1", "quran"),
            name: "Al-Faatiha",
            revelation: "Mecca",
            translation: "The Opening",
            verses: [
              {
                arabic: "بِسْمِ اللّٰهِ الرَّحْمٰنِ الرَّحِيْمِ",
                number: 1,
                ...(input.include_tafsir ? { tafsir: "Tafsir" } : {}),
                translation: "In the name of Allah.",
                transliteration: "Bismillahirrahmanirrahim",
              },
              {
                arabic: "الْحَمْدُ لِلّٰهِ رَبِّ الْعٰلَمِيْنَ",
                number: 2,
                ...(input.include_tafsir ? { tafsir: "Tafsir" } : {}),
                translation: "All praise is for Allah.",
                transliteration: "Alhamdulillahi rabbil alamin",
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
  it("returns structured Quran references", async () => {
    const result = await Effect.runPromise(
      getNakafaQuranReferenceToolResult({
        from_verse: 1,
        include_tafsir: true,
        locale: "en",
        surah: 1,
        to_verse: 2,
      })
    );
    const reference = Schema.decodeUnknownSync(NakafaAgentQuranReferenceSchema)(
      result.structuredContent
    );

    expect(result.isError).not.toBe(true);
    expect(reference.content_id).toBe(
      buildNakafaContentRef("en", "quran/1", "quran").content_id
    );
    expect(reference.verses).toHaveLength(2);
    expect(reference.verses[0].tafsir).toBeTruthy();
  });

  it("returns structured read-model input errors", async () => {
    const result = await Effect.runPromise(
      getNakafaQuranReferenceToolResult({
        from_verse: 1,
        include_tafsir: false,
        locale: "en",
        surah: 999,
      })
    );

    expect(
      Schema.decodeUnknownSync(ToolErrorResultSchema)(result).structuredContent
        .error
    ).toStrictEqual({
      message: "Invalid Nakafa Quran reference options.",
      suggestions: [expect.stringContaining("Surah number")],
    });
  });

  it("returns structured range and missing-reference errors", async () => {
    const reversed = await Effect.runPromise(
      getNakafaQuranReferenceToolResult({
        from_verse: 3,
        locale: "en",
        surah: 1,
        to_verse: 2,
      })
    );
    const large = await Effect.runPromise(
      getNakafaQuranReferenceToolResult({
        from_verse: 1,
        locale: "en",
        surah: 2,
        to_verse: 30,
      })
    );
    const missing = await Effect.runPromise(
      getNakafaQuranReferenceToolResult({
        from_verse: 999,
        locale: "en",
        surah: 1,
      })
    );

    expect(
      Schema.decodeUnknownSync(ToolErrorResultSchema)(reversed)
        .structuredContent.error.message
    ).toBe("Invalid Quran verse range.");
    expect(
      Schema.decodeUnknownSync(ToolErrorResultSchema)(large).structuredContent
        .error.message
    ).toBe("Quran reference range is too large.");
    expect(
      Schema.decodeUnknownSync(ToolErrorResultSchema)(missing).structuredContent
        .error.message
    ).toBe("Nakafa Quran reference was not found.");
  });
});
