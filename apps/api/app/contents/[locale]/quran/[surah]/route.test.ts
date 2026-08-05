import { Effect } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const quranMocks = vi.hoisted(() => ({
  readQuranApiPage: vi.fn(),
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
  readQuranApiPage: quranMocks.readQuranApiPage,
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe("Quran content API route", () => {
  it("returns the requested locale from the signed publication", async () => {
    quranMocks.readQuranApiPage.mockReturnValue(
      Effect.succeed({
        surah: { englishName: "Al-Faatiha", number: 1 },
        verses: [{ number: 1, translation: "In the name of Allah." }],
      })
    );

    const response = await GET(
      new Request("http://localhost/contents/en/quran/1"),
      { params: Promise.resolve({ locale: "en", surah: "1" }) }
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      englishName: "Al-Faatiha",
      number: 1,
      verses: [{ number: 1, translation: "In the name of Allah." }],
    });
    expect(quranMocks.readQuranApiPage).toHaveBeenCalledWith({
      locale: "en",
      surahNumber: 1,
    });
  });

  it("rejects invalid locales before reading Convex", async () => {
    const response = await GET(
      new Request("http://localhost/contents/de/quran/1"),
      { params: Promise.resolve({ locale: "de", surah: "1" }) }
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Invalid locale. Supported locales: en, id.",
    });
    expect(quranMocks.readQuranApiPage).not.toHaveBeenCalled();
  });

  it("rejects non-canonical surah segments before reading Convex", async () => {
    const response = await GET(
      new Request("http://localhost/contents/id/quran/01"),
      { params: Promise.resolve({ locale: "id", surah: "01" }) }
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Failed to fetch surah." });
    expect(quranMocks.readQuranApiPage).not.toHaveBeenCalled();
  });

  it("logs signed publication failures with locale and surah context", async () => {
    const readError = new Error("Publication unavailable");
    quranMocks.readQuranApiPage.mockReturnValue(Effect.fail(readError));

    const response = await GET(
      new Request("http://localhost/contents/id/quran/1"),
      { params: Promise.resolve({ locale: "id", surah: "1" }) }
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Failed to fetch surah." });
    expect(loggingMocks.logError).toHaveBeenCalledWith(readError, {
      service: "api-quran",
      locale: "id",
      surah: 1,
      message: "Failed to fetch surah.",
    });
  });

  it("normalizes non-Error publication failures before logging", async () => {
    quranMocks.readQuranApiPage.mockReturnValue(
      Effect.fail("Publication unavailable")
    );

    const response = await GET(
      new Request("http://localhost/contents/en/quran/2"),
      { params: Promise.resolve({ locale: "en", surah: "2" }) }
    );

    expect(response.status).toBe(500);
    expect(loggingMocks.logError).toHaveBeenCalledWith(
      new Error("Publication unavailable"),
      {
        service: "api-quran",
        locale: "en",
        surah: 2,
        message: "Failed to fetch surah.",
      }
    );
  });
});
