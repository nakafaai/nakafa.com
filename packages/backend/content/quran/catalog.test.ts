import { describe, expect, it } from "@effect/vitest";
import { QURAN_SURAH_COUNT } from "@nakafa/aksara-contracts/quran/spec";
import { MutationCtx } from "@repo/backend/confect/_generated/services";
import { decodeSnapshotRowJson } from "@repo/backend/confect/contentRelease/parse";
import { Confect, confectLayer } from "@repo/backend/confect/test.setup";
import { readQuranSurahs } from "@repo/backend/content/quran/catalog";
import { quranLayer } from "@repo/backend/content/quran/confect";
import { makeQuranSurah } from "@repo/backend/test/quran/rows";
import { activateQuranSnapshot } from "@repo/backend/test/quran/snapshot";
import { Array as Arr, Effect } from "effect";

/** Builds the complete technical surah catalog. */
function makeSurahCatalog() {
  return Array.from(
    {
      length: QURAN_SURAH_COUNT,
    },
    (_, index) => makeQuranSurah(index + 1)
  );
}
describe("contentRelease/quran/catalog", () => {
  it.effect("returns an unmanaged catalog before publication", () =>
    Effect.gen(function* () {
      const t = yield* Confect.pipe(Effect.provide(confectLayer));
      yield* t.run(
        Effect.gen(function* () {
          const _tCtx = yield* MutationCtx;
          expect(
            yield* readQuranSurahs().pipe(Effect.provide(quranLayer))
          ).toMatchObject({
            managed: false,
            rowJson: [],
          });
        })
      );
    })
  );
  it.live("returns the complete verified catalog", () =>
    Effect.gen(function* () {
      const t = yield* Confect.pipe(Effect.provide(confectLayer));
      yield* t.run(
        Effect.gen(function* () {
          const tCtx = yield* MutationCtx;
          const snapshotId = yield* Effect.promise(() =>
            activateQuranSnapshot(tCtx, makeSurahCatalog())
          );
          const catalog = yield* readQuranSurahs().pipe(
            Effect.provide(quranLayer)
          );
          const first = yield* decodeSnapshotRowJson(catalog.rowJson[0] ?? "");
          expect(catalog).toMatchObject({
            managed: true,
            snapshotId,
          });
          expect(catalog.rowJson).toHaveLength(QURAN_SURAH_COUNT);
          expect(first).toMatchObject({
            family: "quran",
            record: {
              payload: {
                kind: "quran-surah",
                number: 1,
              },
            },
          });
        })
      );
    })
  );
  it.effect("fails closed for incomplete or noncanonical catalogs", () =>
    Effect.gen(function* () {
      const incomplete = yield* Confect.pipe(Effect.provide(confectLayer));
      yield* incomplete.run(
        Effect.gen(function* () {
          const incompleteCtx = yield* MutationCtx;
          yield* Effect.promise(() =>
            activateQuranSnapshot(
              incompleteCtx,
              Arr.take(makeSurahCatalog(), QURAN_SURAH_COUNT - 1)
            )
          );
          expect(
            yield* readQuranSurahs().pipe(
              Effect.provide(quranLayer),
              Effect.flip
            )
          ).toMatchObject({
            code: "CONTENT_RELEASE_INTEGRITY",
          });
          const duplicate = yield* Confect.pipe(Effect.provide(confectLayer));
          yield* duplicate.run(
            Effect.gen(function* () {
              const duplicateCtx = yield* MutationCtx;
              const rows = makeSurahCatalog();
              rows[QURAN_SURAH_COUNT - 1] = makeQuranSurah(
                QURAN_SURAH_COUNT - 1
              );
              yield* Effect.promise(() =>
                activateQuranSnapshot(duplicateCtx, rows)
              );
              expect(
                yield* readQuranSurahs().pipe(
                  Effect.provide(quranLayer),
                  Effect.flip
                )
              ).toMatchObject({
                code: "CONTENT_RELEASE_INTEGRITY",
              });
            })
          );
        })
      );
    })
  );
});
