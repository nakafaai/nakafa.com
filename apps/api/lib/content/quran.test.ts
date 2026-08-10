import { Sha256HashSchema } from "@nakafa/aksara-contracts/ids";
import { Effect } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";
import { readQuranApiDocument } from "@/lib/content/quran";

const runtimeClientMocks = vi.hoisted(() => ({
  runtimeQuery: vi.fn(),
}));

vi.mock("@repo/backend/client/runtime", () => ({
  readConvexRuntimeQuery: (url: string, query: unknown, args: unknown) =>
    Effect.tryPromise({
      catch: (cause) => cause,
      try: () => runtimeClientMocks.runtimeQuery(url, query, args),
    }),
}));

const source = {
  activeManifestHash: Sha256HashSchema.make(`sha256:${"a".repeat(64)}`),
  activeReleaseId: "quran-release",
  managed: true,
  snapshotId: Sha256HashSchema.make(`sha256:${"b".repeat(64)}`),
  sourceRevision: "c".repeat(40),
};

afterEach(() => {
  runtimeClientMocks.runtimeQuery.mockReset();
});

describe("Quran API content", () => {
  it("reads and validates one locale-specific signed Quran document", async () => {
    runtimeClientMocks.runtimeQuery.mockResolvedValueOnce({
      ...source,
      locale: "en",
      surah: {
        kind: "quran-surah",
        name: {
          arabic: "الفاتحة",
          translation: "The Opening",
          transliteration: "Al-Fatihah",
        },
        number: 1,
        numberOfVerses: 1,
        revelation: { order: 5, place: "Meccan" },
      },
      verses: [
        {
          arabic: "بِسْمِ اللّٰهِ",
          number: { inQuran: 1, inSurah: 1 },
          translation: { footnotes: "Source note.", text: "In Allah's name." },
        },
      ],
    });

    await expect(
      Effect.runPromise(readQuranApiDocument({ locale: "en", surahNumber: 1 }))
    ).resolves.toMatchObject({
      locale: "en",
      surah: { number: 1, revelation: { order: 5, place: "Meccan" } },
      verses: [
        {
          translation: { footnotes: "Source note.", text: "In Allah's name." },
        },
      ],
    });
    expect(runtimeClientMocks.runtimeQuery).toHaveBeenCalledWith(
      "https://test.convex.cloud",
      expect.anything(),
      { locale: "en", surahNumber: 1 }
    );
  });

  it("maps transport and publication failures into its domain error", async () => {
    runtimeClientMocks.runtimeQuery.mockRejectedValueOnce(new Error("offline"));
    await expect(
      Effect.runPromise(
        Effect.either(readQuranApiDocument({ locale: "en", surahNumber: 1 }))
      )
    ).resolves.toMatchObject({
      _tag: "Left",
      left: { _tag: "QuranApiReadError" },
    });

    runtimeClientMocks.runtimeQuery.mockResolvedValueOnce({
      ...source,
      locale: "en",
      surah: null,
      verses: [],
    });
    await expect(
      Effect.runPromise(
        Effect.either(readQuranApiDocument({ locale: "en", surahNumber: 1 }))
      )
    ).resolves.toMatchObject({
      _tag: "Left",
      left: { _tag: "QuranApiReadError" },
    });
  });
});
