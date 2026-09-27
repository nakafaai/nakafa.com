import { describe, expect, it } from "@effect/vitest";
import { QuranSurahRowSchema } from "@nakafa/aksara-contracts/quran/spec";
import { MutationCtx } from "@repo/backend/confect/_generated/services";
import { Confect, confectLayer } from "@repo/backend/confect/test.setup";
import { quranLayer } from "@repo/backend/content/quran/confect";
import { readQuranRow } from "@repo/backend/content/quran/row";
import { makeQuranSurah } from "@repo/backend/test/quran/rows";
import { activateQuranSnapshot } from "@repo/backend/test/quran/snapshot";
import { Effect } from "effect";

describe("contentRelease/quran/row", () => {
  it.effect("reads one exact verified row and rejects a missing identity", () =>
    Effect.gen(function* () {
      const t = yield* Confect.pipe(Effect.provide(confectLayer));
      yield* t.run(
        Effect.gen(function* () {
          const tCtx = yield* MutationCtx;
          const snapshotId = yield* Effect.promise(() =>
            activateQuranSnapshot(tCtx, [makeQuranSurah(1)])
          );
          expect(
            yield* readQuranRow(
              snapshotId,
              "surah:1",
              QuranSurahRowSchema
            ).pipe(Effect.provide(quranLayer))
          ).toMatchObject({
            payload: {
              kind: "quran-surah",
              number: 1,
            },
            rowJson: expect.any(String),
          });
          expect(
            yield* readQuranRow(
              snapshotId,
              "surah:2",
              QuranSurahRowSchema
            ).pipe(Effect.provide(quranLayer), Effect.flip)
          ).toMatchObject({
            code: "CONTENT_RELEASE_INTEGRITY",
          });
        })
      );
    })
  );
});
