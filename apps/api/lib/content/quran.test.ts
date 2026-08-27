import { Sha256HashSchema } from "@nakafa/aksara-contracts/ids";
import {
  makeQuranLocaleSources,
  makeQuranTafsirProjection,
} from "@repo/backend/test/quran/rows";
import { toRuntimeQueryError } from "@repo/backend/test/runtime-query";
import { afterEach, describe, expect, it } from "@repo/testing/effect";
import { Effect } from "effect";
import { vi } from "vitest";
import { readQuranApiDocument } from "@/lib/content/quran";

const runtimeClientMocks = vi.hoisted(() => ({
  runtimeQuery: vi.fn(),
}));
vi.mock("@repo/backend/client/runtime", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@repo/backend/client/runtime")>();

  return {
    ...actual,
    readConvexRuntimeQuery: (url: string, query: unknown, args: unknown) =>
      Effect.tryPromise({
        catch: toRuntimeQueryError,
        try: () => runtimeClientMocks.runtimeQuery(url, query, args),
      }),
  };
});
const source = {
  activeManifestHash: Sha256HashSchema.make(`sha256:${"a".repeat(64)}`),
  activeReleaseId: "quran-release",
  managed: true,
  snapshotId: Sha256HashSchema.make(`sha256:${"b".repeat(64)}`),
  sourceOrigin: { kind: "git" as const, sha: "c".repeat(40) },
  sourceRevision: "c".repeat(40),
};
afterEach(() => {
  runtimeClientMocks.runtimeQuery.mockReset();
});
describe("Quran API content", () => {
  it.live("reads and validates one locale-specific signed Quran document", () =>
    Effect.gen(function* () {
      runtimeClientMocks.runtimeQuery.mockResolvedValueOnce({
        ...source,
        appLocale: "en",
        preBismillah: null,
        sources: makeQuranLocaleSources("en"),
        surah: {
          kind: "quran-surah",
          name: {
            arabic: "الفاتحة",
            meaning: "The Opening",
            transliteration: "Al-Fatihah",
          },
          number: 1,
          numberOfVerses: 1,
          revelation: { order: 5, place: "Meccan" },
        },
        tafsirAccess: makeQuranTafsirProjection("en"),
        verses: [
          {
            arabic: "بِسْمِ اللّٰهِ",
            number: { inQuran: 1, inSurah: 1 },
            translation: {
              notes: [
                {
                  number: 1,
                  referenceOffset: 16,
                  text: "Source note.",
                },
              ],
              segments: [
                { kind: "text", offset: 0, value: "In Allah's name." },
                { kind: "note", number: 1, offset: 16 },
              ],
            },
          },
        ],
      });
      expect(
        yield* readQuranApiDocument({ appLocale: "en", surahNumber: 1 })
      ).toMatchObject({
        appLocale: "en",
        surah: { number: 1, revelation: { order: 5, place: "Meccan" } },
        verses: [
          {
            translation: {
              notes: [expect.objectContaining({ number: 1 })],
              segments: [
                expect.objectContaining({ kind: "text" }),
                expect.objectContaining({ kind: "note", number: 1 }),
              ],
            },
          },
        ],
      });
      expect(runtimeClientMocks.runtimeQuery).toHaveBeenCalledWith(
        "https://test.convex.cloud",
        expect.anything(),
        { appLocale: "en", surahNumber: 1 }
      );
    })
  );
  it.live("maps transport and publication failures into its domain error", () =>
    Effect.gen(function* () {
      runtimeClientMocks.runtimeQuery.mockRejectedValueOnce(
        new Error("offline")
      );
      expect(
        yield* Effect.result(
          readQuranApiDocument({ appLocale: "en", surahNumber: 1 })
        )
      ).toMatchObject({
        _tag: "Failure",
        failure: { _tag: "QuranApiReadError" },
      });
      runtimeClientMocks.runtimeQuery.mockResolvedValueOnce({
        ...source,
        appLocale: "en",
        preBismillah: null,
        sources: null,
        surah: null,
        tafsirAccess: null,
        verses: [],
      });
      expect(
        yield* Effect.result(
          readQuranApiDocument({ appLocale: "en", surahNumber: 1 })
        )
      ).toMatchObject({
        _tag: "Failure",
        failure: { _tag: "QuranApiReadError" },
      });
    })
  );
});
