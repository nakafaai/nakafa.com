import { Sha256HashSchema } from "@nakafa/aksara-contracts/ids";
import { QuranPublicationError } from "@repo/backend/client/quran/decode";
import {
  decodePublishedQuranInterpretation,
  type PublishedQuranInterpretation,
} from "@repo/backend/client/quran/interpretation";
import type { api } from "@repo/backend/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

const source = {
  activeManifestHash: `sha256:${"a".repeat(64)}`,
  activeReleaseId: "quran-release",
  managed: true,
  snapshotId: Sha256HashSchema.make(`sha256:${"b".repeat(64)}`),
  sourceRevision: "c".repeat(40),
};

type QuranInterpretationResult = FunctionReturnType<
  typeof api.contentRelease.quran.interpretation
>;

const activeInterpretation: QuranInterpretationResult = {
  ...source,
  interpretation: "Tafsir ayat tujuh.",
  locale: "id",
  surahNumber: 1,
  verseNumber: 7,
};

describe("signed Quran interpretation decoder", () => {
  it("preserves one exact active tafsir", async () => {
    const interpretation = await Effect.runPromise(
      decodePublishedQuranInterpretation(activeInterpretation, {
        locale: "id",
        snapshotId: source.snapshotId,
        surahNumber: 1,
        verseNumber: 7,
      })
    );

    expect(interpretation).toMatchObject({
      interpretation: "Tafsir ayat tujuh.",
      locale: "id",
      surahNumber: 1,
      verseNumber: 7,
    } satisfies Partial<PublishedQuranInterpretation>);
  });

  it("fails closed for inactive, stale, mismatched, and empty responses", async () => {
    const inactive: QuranInterpretationResult = {
      activeManifestHash: null,
      activeReleaseId: null,
      interpretation: null,
      locale: "id",
      managed: false,
      snapshotId: null,
      sourceRevision: null,
      surahNumber: 1,
      verseNumber: 7,
    };
    const mismatched: QuranInterpretationResult = {
      ...activeInterpretation,
      verseNumber: 6,
    };
    const stale: QuranInterpretationResult = {
      ...activeInterpretation,
      snapshotId: Sha256HashSchema.make(`sha256:${"d".repeat(64)}`),
    };
    const empty: QuranInterpretationResult = {
      ...activeInterpretation,
      interpretation: "   ",
    };

    for (const result of [inactive, stale, mismatched, empty]) {
      const decoded = await Effect.runPromise(
        Effect.either(
          decodePublishedQuranInterpretation(result, {
            locale: "id",
            snapshotId: source.snapshotId,
            surahNumber: 1,
            verseNumber: 7,
          })
        )
      );

      expect(decoded._tag).toBe("Left");
      if (decoded._tag === "Left") {
        expect(decoded.left).toBeInstanceOf(QuranPublicationError);
      }
    }
  });
});
