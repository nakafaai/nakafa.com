import { ENGLISH_APP_LOCALE_CODE } from "@nakafa/aksara-contracts/locale";
import {
  quranReadingSourceIds,
  quranTafsirSourceId,
} from "@nakafa/aksara-contracts/quran/identity";
import { readNakafaContentRefFixture } from "@repo/contents/_lib/agent/fixture";
import { NakafaAgentQuranReferenceSchema } from "@repo/contents/_lib/agent/schema/quran/reference";
import { describe, expect, it } from "@repo/testing/effect";
import { Effect, Schema } from "effect";
import { vi } from "vitest";
import { getNakafaQuranReferenceToolResult } from "@/lib/mcp/tools/quran";

vi.mock("@/lib/mcp/nakafa", async () => {
  const { Effect, Option } = await import("effect");

  return {
    nakafaContent: {
      /** Returns deterministic Quran references for MCP result tests. */
      quran: (input: { from_verse: number }) =>
        Effect.succeed(
          input.from_verse === 999
            ? Option.none()
            : Option.some(makeReference())
        ),
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
  it.live("returns semantic notes and signed source access", () =>
    Effect.gen(function* () {
      const result = yield* getNakafaQuranReferenceToolResult({
        from_verse: 1,
        include_tafsir: true,
        locale: "en",
        surah: 1,
      });
      const reference = yield* Schema.decodeUnknownEffect(
        NakafaAgentQuranReferenceSchema
      )(result.structuredContent);

      expect(result.isError).not.toBe(true);
      expect(reference.content_id).toBe(
        readNakafaContentRefFixture("en", "quran/1", "quran").content_id
      );
      expect(reference.meaning).toEqual({
        locale: ENGLISH_APP_LOCALE_CODE,
        text: "The Opening",
      });
      expect(reference.pre_bismillah).toEqual({
        arabic: "بِسْمِ اللّٰهِ الرَّحْمٰنِ الرَّحِيْمِ",
        translation: "In the name of Allah.",
      });
      expect(reference.sources).toMatchObject({
        arabic: { id: ARABIC_SOURCE_ID },
        translation: {
          id: TRANSLATION_SOURCE_ID,
          locale: ENGLISH_APP_LOCALE_CODE,
        },
      });
      expect(reference.tafsir_access).toMatchObject({
        kind: "external",
        source: { id: TAFSIR_SOURCE_ID },
      });
      expect(reference.verses[0]?.translation.notes[0]).toMatchObject({
        number: 1,
        text: "Exact source note.",
      });
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

const ARTIFACT = {
  byte_count: 1,
  digest: `sha256:${"1".repeat(64)}`,
  file_count: 1,
};
const [ARABIC_SOURCE_ID, TRANSLATION_SOURCE_ID] = quranReadingSourceIds(
  ENGLISH_APP_LOCALE_CODE
);
const TAFSIR_SOURCE_ID = quranTafsirSourceId(ENGLISH_APP_LOCALE_CODE);

/** Builds one complete embedded source fixture. */
function embeddedSource(
  id: typeof ARABIC_SOURCE_ID | typeof TRANSLATION_SOURCE_ID
) {
  return {
    artifact: ARTIFACT,
    id,
    kind: "embedded" as const,
    label: `Technical ${id}`,
    notice: `Technical ${id} notice.`,
    publisher: "Technical publisher",
    retrieved_at: "2026-08-26T15:51:00Z",
    source_url: `https://example.test/${id}`,
    terms: {
      artifact: ARTIFACT,
      url: `https://example.test/${id}/terms`,
    },
    update_url: `https://example.test/${id}/updates`,
    version: "technical-version",
  };
}

/** Builds one complete Quran reference fixture. */
function makeReference() {
  return {
    ...readNakafaContentRefFixture("en", "quran/1", "quran"),
    meaning: { locale: ENGLISH_APP_LOCALE_CODE, text: "The Opening" },
    name: "Al-Faatiha",
    pre_bismillah: {
      arabic: "بِسْمِ اللّٰهِ الرَّحْمٰنِ الرَّحِيْمِ",
      translation: "In the name of Allah.",
    },
    revelation: "Meccan",
    sources: {
      arabic: embeddedSource(ARABIC_SOURCE_ID),
      translation: {
        ...embeddedSource(TRANSLATION_SOURCE_ID),
        locale: ENGLISH_APP_LOCALE_CODE,
      },
    },
    tafsir_access: {
      kind: "external" as const,
      locale: ENGLISH_APP_LOCALE_CODE,
      notice: "Technical link-only source notice.",
      source: {
        id: TAFSIR_SOURCE_ID,
        kind: "external" as const,
        label: "Technical external source",
        notice: "Technical external source notice.",
        publisher: "Technical publisher",
        retrieved_at: "2026-08-26T15:51:00Z",
        source_url: `https://example.test/${TAFSIR_SOURCE_ID}`,
        terms: {
          access: "link-only" as const,
          url: `https://example.test/${TAFSIR_SOURCE_ID}/terms`,
        },
        update_url: `https://example.test/${TAFSIR_SOURCE_ID}/updates`,
        version: "technical-version",
      },
    },
    verses: [
      {
        arabic: "بِسْمِ اللّٰهِ الرَّحْمٰنِ الرَّحِيْمِ",
        number: 1,
        translation: {
          notes: [
            { number: 1, referenceOffset: 21, text: "Exact source note." },
          ],
          segments: [
            {
              kind: "text" as const,
              offset: 0,
              value: "In the name of Allah. ",
            },
            { kind: "note" as const, number: 1, offset: 21 },
          ],
        },
      },
    ],
  };
}
