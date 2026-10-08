import { describe, expect, it } from "@effect/vitest";
import { MutationCtx } from "@repo/backend/confect/_generated/services";
import { Confect, confectLayer } from "@repo/backend/confect/test.setup";
import { quranLayer } from "@repo/backend/content/quran/confect";
import { readQuranInterpretation } from "@repo/backend/content/quran/interpretation";
import {
  makeQuranAttribution,
  makeQuranChunk,
  makeQuranSearch,
  makeQuranSurah,
} from "@repo/backend/test/quran/rows";
import {
  activateQuranSnapshot,
  restoreAbsentQuranSnapshot,
} from "@repo/backend/test/quran/snapshot";
import { Array as Arr, Effect } from "effect";

/** Creates only the signed rows required to read verse seven. */
function interpretationRows() {
  return [
    makeQuranAttribution(),
    makeQuranSurah(1, 7),
    makeQuranChunk({
      firstQuranNumber: 7,
      firstVerse: 7,
      surahNumber: 1,
      verseCount: 1,
    }),
    makeQuranSearch("id", 1),
  ];
}
const expectedSnapshotId = `sha256:${"0".repeat(64)}`;
describe("contentRelease/quran/interpretation", () => {
  it.effect("rejects a stale click when Quran has no active snapshot", () =>
    Effect.gen(function* () {
      const t = yield* Confect.pipe(Effect.provide(confectLayer));
      yield* t.run(
        Effect.gen(function* () {
          const _tCtx = yield* MutationCtx;
          expect(
            yield* readQuranInterpretation("id", expectedSnapshotId, 1, 7).pipe(
              Effect.provide(quranLayer),
              Effect.flip
            )
          ).toMatchObject({
            code: "CONTENT_RELEASE_CONFLICT",
          });
        })
      );
    })
  );
  it.effect("returns only the requested tafsir from its signed chunk", () =>
    Effect.gen(function* () {
      const t = yield* Confect.pipe(Effect.provide(confectLayer));
      yield* t.run(
        Effect.gen(function* () {
          const tCtx = yield* MutationCtx;
          const snapshotId = yield* Effect.promise(() =>
            activateQuranSnapshot(tCtx, interpretationRows())
          );
          expect(
            yield* readQuranInterpretation("id", snapshotId, 1, 7).pipe(
              Effect.provide(quranLayer)
            )
          ).toMatchObject({
            appLocale: "id",
            interpretation: "Tafsir teknis 7",
            managed: true,
            snapshotId,
            surahNumber: 1,
            verseNumber: 7,
          });
        })
      );
    })
  );
  it.effect("rejects requests beyond the signed surah boundary", () =>
    Effect.gen(function* () {
      const t = yield* Confect.pipe(Effect.provide(confectLayer));
      yield* t.run(
        Effect.gen(function* () {
          const tCtx = yield* MutationCtx;
          const snapshotId = yield* Effect.promise(() =>
            activateQuranSnapshot(tCtx, interpretationRows())
          );
          expect(
            yield* readQuranInterpretation("id", snapshotId, 1, 8).pipe(
              Effect.provide(quranLayer),
              Effect.flip
            )
          ).toMatchObject({
            code: "CONTENT_RELEASE_INVALID_REQUEST",
          });
        })
      );
    })
  );
  it.effect("rejects a click from a superseded signed snapshot", () =>
    Effect.gen(function* () {
      const t = yield* Confect.pipe(Effect.provide(confectLayer));
      yield* t.run(
        Effect.gen(function* () {
          const tCtx = yield* MutationCtx;
          yield* Effect.promise(() =>
            activateQuranSnapshot(tCtx, interpretationRows())
          );
          expect(
            yield* readQuranInterpretation("id", expectedSnapshotId, 1, 7).pipe(
              Effect.provide(quranLayer),
              Effect.flip
            )
          ).toMatchObject({
            code: "CONTENT_RELEASE_CONFLICT",
          });
        })
      );
    })
  );
  it.effect("rejects a click after recovery restores the absent snapshot", () =>
    Effect.gen(function* () {
      const t = yield* Confect.pipe(Effect.provide(confectLayer));
      yield* t.run(
        Effect.gen(function* () {
          const tCtx = yield* MutationCtx;
          const snapshotId = yield* Effect.promise(() =>
            activateQuranSnapshot(tCtx, interpretationRows())
          );
          yield* Effect.promise(() =>
            restoreAbsentQuranSnapshot(tCtx, snapshotId)
          );
          expect(
            yield* readQuranInterpretation("id", snapshotId, 1, 7).pipe(
              Effect.provide(quranLayer),
              Effect.flip
            )
          ).toMatchObject({
            code: "CONTENT_RELEASE_CONFLICT",
          });
        })
      );
    })
  );
  it.effect("does not read the unrelated signed search projection", () =>
    Effect.gen(function* () {
      const t = yield* Confect.pipe(Effect.provide(confectLayer));
      yield* t.run(
        Effect.gen(function* () {
          const tCtx = yield* MutationCtx;
          const snapshotId = yield* Effect.promise(() =>
            activateQuranSnapshot(
              tCtx,
              Arr.filter(
                interpretationRows(),
                (row) => row.kind !== "quran-search"
              )
            )
          );
          expect(
            yield* readQuranInterpretation("id", snapshotId, 1, 7).pipe(
              Effect.provide(quranLayer)
            )
          ).toMatchObject({
            interpretation: "Tafsir teknis 7",
            snapshotId,
            verseNumber: 7,
          });
        })
      );
    })
  );
});
