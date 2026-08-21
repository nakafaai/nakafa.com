import { Nakafa } from "@repo/ai/agents/nakafa/service";
import { quran } from "@repo/ai/agents/nakafa/tools/quran";
import {
  createNakafaTestService,
  createWriter,
} from "@repo/ai/agents/nakafa/tools/test";
import { describe, expect, it } from "@repo/testing/effect";
import { Effect } from "effect";

describe("nakafa Quran tool", () => {
  it.live("writes loading and done parts for bounded Quran references", () =>
    Effect.gen(function* () {
      const { parts, writer } = createWriter();
      const output = yield* quran({
        input: {
          from_verse: 1,
          include_tafsir: false,
          locale: "en",
          surah: 1,
          to_verse: 1,
        },
        locale: "en",
        toolCallId: "quran-1",
        writer,
      }).pipe(Effect.provideService(Nakafa, createNakafaTestService()));

      expect(output).toContain("# Nakafa Quran Reference");
      expect(parts.at(-1)).toEqual(
        expect.objectContaining({
          data: expect.objectContaining({
            kind: "quran",
            status: "done",
            result: expect.objectContaining({ verse_count: 1 }),
          }),
        })
      );
    })
  );

  it.live(
    "applies defaults and preserves tafsir requests in persisted input",
    () =>
      Effect.gen(function* () {
        const { parts, writer } = createWriter();
        const output = yield* quran({
          input: {
            include_tafsir: true,
            surah: 1,
          },
          locale: "id",
          toolCallId: "quran-defaults",
          writer,
        }).pipe(Effect.provideService(Nakafa, createNakafaTestService()));

        expect(output).toContain("- Tafsir:");
        expect(parts.at(0)).toEqual(
          expect.objectContaining({
            data: expect.objectContaining({
              input: {
                from_verse: 1,
                include_tafsir: true,
                locale: "id",
                surah: 1,
              },
            }),
          })
        );
      })
  );

  it.live.each([
    [
      "reversed range",
      { from_verse: 2, locale: "en", surah: 1, to_verse: 1 },
      "Invalid Quran verse range.",
    ],
    [
      "oversized range",
      { from_verse: 1, locale: "en", surah: 2, to_verse: 21 },
      "Quran reference range is too large.",
    ],
    [
      "invalid schema",
      { from_verse: 1, locale: "en", surah: 999 },
      "Invalid Nakafa Quran reference options.",
    ],
    [
      "missing verse",
      { from_verse: 999, locale: "en", surah: 1 },
      "Nakafa Quran reference was not found.",
    ],
  ] as const)("writes an error part for %s", ([, input, message]) =>
    Effect.gen(function* () {
      const { parts, writer } = createWriter();
      const output = yield* quran({
        input,
        locale: "en",
        toolCallId: "quran-error",
        writer,
      }).pipe(Effect.provideService(Nakafa, createNakafaTestService()));

      expect(output).toBe(message);
      expect(parts.at(-1)).toEqual(
        expect.objectContaining({
          data: expect.objectContaining({
            kind: "quran",
            status: "error",
            error: message,
          }),
        })
      );
    })
  );
});
