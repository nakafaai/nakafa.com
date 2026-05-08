import { fetchQuran } from "@repo/ai/agents/content/tools/material/quran";
import type { MyUIMessage } from "@repo/ai/types/message";
import { getSurah } from "@repo/contents/_lib/quran";
import { SurahNotFoundError } from "@repo/contents/_shared/error";
import type { Surah, Verse } from "@repo/contents/_types/quran";
import type { UIMessageStreamWriter } from "ai";
import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";

vi.mock("@repo/contents/_lib/quran", () => ({
  getSurah: vi.fn(),
}));

const verse = {
  number: { inSurah: 1, inQuran: 1 },
  meta: {
    juz: 1,
    page: 1,
    manzil: 1,
    ruku: 1,
    hizbQuarter: 1,
    sajda: { recommended: false, obligatory: false },
  },
  text: {
    arab: "بسم الله",
    transliteration: { en: "Bismillah" },
  },
  translation: {
    en: "In the name of Allah",
    id: "Dengan nama Allah",
  },
  audio: {
    primary: "",
    secondary: [],
  },
  tafsir: {
    id: {
      short: "",
      long: "",
    },
  },
} satisfies Verse;

/**
 * Creates a test writer that records AI SDK UI message stream parts.
 */
function createWriter() {
  const parts: Parameters<UIMessageStreamWriter<MyUIMessage>["write"]>[0][] =
    [];
  const writer = {
    onError: undefined,
    merge(stream) {
      stream.getReader().releaseLock();
    },
    write(part) {
      parts.push(part);
    },
  } satisfies UIMessageStreamWriter<MyUIMessage>;

  return { parts, writer };
}

/**
 * Creates a minimal surah payload for content-tool tests.
 */
function createSurah(overrides: Partial<Surah> = {}) {
  return {
    number: 1,
    sequence: 5,
    numberOfVerses: 1,
    name: {
      short: "الفاتحة",
      long: "سورة الفاتحة",
      transliteration: { en: "Al-Fatihah", id: "Al-Fatihah" },
      translation: { en: "The Opening", id: "Pembukaan" },
    },
    revelation: {
      arab: "مكية",
      en: "Meccan",
      id: "Makkiyah",
    },
    verses: [verse],
    ...overrides,
  } satisfies Surah;
}

describe("material/quran", () => {
  it("rejects invalid Quran slugs before content lookup", async () => {
    const { parts, writer } = createWriter();

    const output = await Effect.runPromise(
      fetchQuran({
        cleanedSlug: "quran/1/al-fatihah",
        contentInput: { locale: "id", slug: "quran/1/al-fatihah" },
        toolCallId: "tool-1",
        url: "https://nakafa.com/id/quran/1/al-fatihah",
        writer,
      })
    );

    expect(output).toContain("# Content");
    expect(getSurah).not.toHaveBeenCalled();
    expect(parts.at(-1)).toMatchObject({
      data: {
        status: "error",
        error: "Surah not found. Maybe not available or still in development.",
      },
    });
  });

  it("fetches Quran content through the contents package", async () => {
    vi.mocked(getSurah).mockReturnValue(Effect.succeed(createSurah()));
    const { parts, writer } = createWriter();

    const output = await Effect.runPromise(
      fetchQuran({
        cleanedSlug: "quran/1",
        contentInput: { locale: "id", slug: "quran/1" },
        toolCallId: "tool-1",
        url: "https://nakafa.com/id/quran/1",
        writer,
      })
    );

    expect(output).toContain("Al-Fatihah");
    expect(parts.at(-1)).toMatchObject({
      data: {
        title: "Pembukaan",
        description: "Makkiyah",
        status: "done",
      },
    });
    expect(getSurah).toHaveBeenCalledWith(1);
  });

  it("formats pre-bismillah and tafsir when present", async () => {
    vi.mocked(getSurah).mockReturnValue(
      Effect.succeed(
        createSurah({
          preBismillah: {
            text: verse.text,
            translation: verse.translation,
            audio: verse.audio,
          },
          verses: [
            {
              ...verse,
              tafsir: {
                id: {
                  short: "Short tafsir",
                  long: "Long tafsir",
                },
              },
            },
          ],
        })
      )
    );
    const { writer } = createWriter();

    const output = await Effect.runPromise(
      fetchQuran({
        cleanedSlug: "quran/1",
        contentInput: { locale: "id", slug: "quran/1" },
        toolCallId: "tool-1",
        url: "https://nakafa.com/id/quran/1",
        writer,
      })
    );

    expect(output).toContain("Pre-Bismillah");
    expect(output).toContain("Short tafsir");
    expect(output).toContain("Long tafsir");
  });

  it("falls back to Arabic metadata when localized labels are empty", async () => {
    vi.mocked(getSurah).mockReturnValue(
      Effect.succeed(
        createSurah({
          name: {
            short: "الفاتحة",
            long: "سورة الفاتحة",
            transliteration: { en: "Al-Fatihah", id: "Al-Fatihah" },
            translation: { en: "", id: "" },
          },
          revelation: {
            arab: "مكية",
            en: "",
            id: "",
          },
        })
      )
    );
    const { parts, writer } = createWriter();

    await Effect.runPromise(
      fetchQuran({
        cleanedSlug: "quran/1",
        contentInput: { locale: "id", slug: "quran/1" },
        toolCallId: "tool-1",
        url: "https://nakafa.com/id/quran/1",
        writer,
      })
    );

    expect(parts.at(-1)).toMatchObject({
      data: {
        title: "الفاتحة",
        description: "مكية",
        status: "done",
      },
    });
  });

  it("writes an error part when Quran content is missing", async () => {
    vi.mocked(getSurah).mockReturnValue(
      Effect.fail(new SurahNotFoundError({ surahNumber: 404 }))
    );
    const { parts, writer } = createWriter();

    const output = await Effect.runPromise(
      fetchQuran({
        cleanedSlug: "quran/404",
        contentInput: { locale: "id", slug: "quran/404" },
        toolCallId: "tool-1",
        url: "https://nakafa.com/id/quran/404",
        writer,
      })
    );

    expect(output).toContain("Surah not found");
    expect(parts.at(-1)).toMatchObject({
      data: {
        status: "error",
        error: "Surah not found. Maybe not available or still in development.",
      },
    });
  });
});
