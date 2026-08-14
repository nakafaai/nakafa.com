import { Effect } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const quranMocks = vi.hoisted(() => ({
  readQuranApiDocument: vi.fn(),
}));
const loggingMocks = vi.hoisted(() => ({
  logError: vi.fn(),
}));

vi.mock("@repo/utilities/logging/effect", async () => {
  const { Effect } = await import("effect");

  return {
    logError: (...args: unknown[]) => {
      loggingMocks.logError(...args);
      return Effect.void;
    },
  };
});

vi.mock("@/lib/content/quran", () => ({
  readQuranApiDocument: quranMocks.readQuranApiDocument,
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe("Quran content API route", () => {
  it("returns one explicit locale-specific signed Quran document", async () => {
    quranMocks.readQuranApiDocument.mockReturnValue(
      Effect.succeed({
        appLocale: "en",
        surah: {
          name: { transliteration: "Al-Faatiha" },
          number: 1,
          revelation: { order: 5, place: "Meccan" },
        },
        verses: [
          {
            arabic: "بِسْمِ اللّٰهِ",
            number: { inSurah: 1 },
            translation: {
              footnotes: "Source note.",
              text: "In Allah's name.",
            },
          },
        ],
      })
    );

    const response = await GET(
      new Request("http://localhost/contents/quran/1"),
      { params: Promise.resolve({ surah: "1" }) }
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      name: { transliteration: "Al-Faatiha" },
      locale: "en",
      number: 1,
      revelation: { order: 5, place: "Meccan" },
      verses: [
        {
          arabic: "بِسْمِ اللّٰهِ",
          number: { inSurah: 1 },
          translation: { footnotes: "Source note.", text: "In Allah's name." },
        },
      ],
    });
    expect(quranMocks.readQuranApiDocument).toHaveBeenCalledWith({
      appLocale: "en",
      surahNumber: 1,
    });
  });

  it("rejects non-canonical surah segments before reading Convex", async () => {
    const response = await GET(
      new Request("http://localhost/contents/quran/01"),
      { params: Promise.resolve({ surah: "01" }) }
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Failed to fetch surah." });
    expect(quranMocks.readQuranApiDocument).not.toHaveBeenCalled();
  });

  it("logs signed publication failures with surah context", async () => {
    const readError = new Error("Publication unavailable");
    quranMocks.readQuranApiDocument.mockReturnValue(Effect.fail(readError));

    const response = await GET(
      new Request("http://localhost/contents/quran/1"),
      { params: Promise.resolve({ surah: "1" }) }
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Failed to fetch surah." });
    expect(loggingMocks.logError).toHaveBeenCalledWith(readError, {
      service: "api-quran",
      surah: 1,
      message: "Failed to fetch surah.",
    });
  });

  it("normalizes non-Error publication failures before logging", async () => {
    quranMocks.readQuranApiDocument.mockReturnValue(
      Effect.fail("Publication unavailable")
    );

    const response = await GET(
      new Request("http://localhost/contents/quran/2"),
      { params: Promise.resolve({ surah: "2" }) }
    );

    expect(response.status).toBe(500);
    expect(loggingMocks.logError).toHaveBeenCalledWith(
      new Error("Publication unavailable"),
      {
        service: "api-quran",
        surah: 2,
        message: "Failed to fetch surah.",
      }
    );
  });
});
