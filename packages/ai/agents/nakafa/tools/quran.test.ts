import { quran } from "@repo/ai/agents/nakafa/tools/quran";
import { createWriter } from "@repo/ai/agents/nakafa/tools/test";
import { Nakafa } from "@repo/contents/_lib/agent/service";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

describe("nakafa Quran tool", () => {
  it("writes loading and done parts for bounded Quran references", async () => {
    const { parts, writer } = createWriter();
    const output = await Effect.runPromise(
      quran({
        input: {
          from_verse: 1,
          include_tafsir: false,
          locale: "en",
          surah: 1,
          to_verse: 1,
        },
        toolCallId: "quran-1",
        writer,
      }).pipe(Effect.provide(Nakafa.Default))
    );

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
  });

  it("applies defaults and preserves tafsir requests in persisted input", async () => {
    const { parts, writer } = createWriter();
    const output = await Effect.runPromise(
      quran({
        input: {
          include_tafsir: true,
          surah: 1,
        },
        toolCallId: "quran-defaults",
        writer,
      }).pipe(Effect.provide(Nakafa.Default))
    );

    expect(output).toContain("- Tafsir:");
    expect(parts.at(0)).toEqual(
      expect.objectContaining({
        data: expect.objectContaining({
          input: {
            from_verse: 1,
            include_tafsir: true,
            locale: "en",
            surah: 1,
          },
        }),
      })
    );
  });

  it.each([
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
  ] as const)("writes an error part for %s", async (_, input, message) => {
    const { parts, writer } = createWriter();
    const output = await Effect.runPromise(
      quran({
        input,
        toolCallId: "quran-error",
        writer,
      }).pipe(Effect.provide(Nakafa.Default))
    );

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
  });
});
