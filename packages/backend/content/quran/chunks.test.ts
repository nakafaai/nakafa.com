import { describe, expect, it } from "@effect/vitest";
import { MutationCtx } from "@repo/backend/confect/_generated/services";
import { Confect, confectLayer } from "@repo/backend/confect/test.setup";
import { readQuranChunks } from "@repo/backend/content/quran/chunks";
import { quranLayer } from "@repo/backend/content/quran/confect";
import { makeQuranChunk } from "@repo/backend/test/quran/rows";
import { activateQuranSnapshot } from "@repo/backend/test/quran/snapshot";
import { Effect } from "effect";

const firstChunk = makeQuranChunk({
  firstQuranNumber: 1,
  firstVerse: 1,
  surahNumber: 1,
  verseCount: 6,
});
const secondChunk = makeQuranChunk({
  firstQuranNumber: 7,
  firstVerse: 7,
  surahNumber: 1,
  verseCount: 1,
});

describe("contentRelease/quran/chunks", () => {
  it.effect("reads only the coherent chunks covering one requested range", () =>
    Effect.gen(function* () {
      const confect = yield* Confect;
      yield* confect.run(
        Effect.gen(function* () {
          const ctx = yield* MutationCtx;
          const snapshotId = yield* Effect.promise(() =>
            activateQuranSnapshot(ctx, [firstChunk, secondChunk])
          );
          expect(
            yield* readQuranChunks({
              fromVerse: 2,
              numberOfVerses: 7,
              snapshotId,
              surahNumber: 1,
              toVerse: 7,
            })
          ).toMatchObject({
            rowJson: [expect.any(String), expect.any(String)],
            rows: [{ firstVerse: 1 }, { firstVerse: 7 }],
          });
        }).pipe(Effect.provide(quranLayer))
      );
    }).pipe(Effect.provide(confectLayer))
  );
  it.effect.each([
    [firstChunk],
    [
      firstChunk,
      makeQuranChunk({
        firstQuranNumber: 8,
        firstVerse: 7,
        surahNumber: 1,
        verseCount: 1,
      }),
    ],
  ])("fails closed for missing or discontinuous chunks: %j", (chunks) =>
    Effect.gen(function* () {
      const confect = yield* Confect;
      yield* confect.run(
        Effect.gen(function* () {
          const ctx = yield* MutationCtx;
          const snapshotId = yield* Effect.promise(() =>
            activateQuranSnapshot(ctx, chunks)
          );
          expect(
            yield* readQuranChunks({
              fromVerse: 1,
              numberOfVerses: 7,
              snapshotId,
              surahNumber: 1,
              toVerse: 7,
            }).pipe(Effect.flip)
          ).toMatchObject({
            _tag: "ReleaseError",
            code: "CONTENT_RELEASE_INTEGRITY",
          });
        }).pipe(Effect.provide(quranLayer))
      );
    }).pipe(Effect.provide(confectLayer))
  );
  it.effect("rejects excessive ranges before reading chunks", () =>
    Effect.gen(function* () {
      const confect = yield* Confect;
      yield* confect.run(
        Effect.gen(function* () {
          expect(
            yield* readQuranChunks({
              fromVerse: 1,
              numberOfVerses: 301,
              snapshotId: "technical-snapshot",
              surahNumber: 1,
              toVerse: 301,
            }).pipe(Effect.flip)
          ).toMatchObject({
            _tag: "ReleaseError",
            code: "CONTENT_RELEASE_LIMIT",
          });
        }).pipe(Effect.provide(quranLayer))
      );
    }).pipe(Effect.provide(confectLayer))
  );
});
