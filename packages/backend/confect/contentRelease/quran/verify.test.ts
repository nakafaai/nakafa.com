import { describe, expect, it } from "@effect/vitest";
import { QuranSearchRowSchema } from "@nakafa/aksara-contracts/quran/snapshot/row";
import { QuranSurahRowSchema } from "@nakafa/aksara-contracts/quran/spec";
import { MutationCtx } from "@repo/backend/confect/_generated/services";
import { QURAN_SEARCH_DOCUMENT_LIMIT } from "@repo/backend/confect/contentRelease/quran/limits";
import { verifyQuranRow } from "@repo/backend/confect/contentRelease/quran/verify";
import { Confect, confectLayer } from "@repo/backend/confect/test.setup";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { makeQuranSearch } from "@repo/backend/test/quran/rows";
import { activateQuranSnapshot } from "@repo/backend/test/quran/snapshot";
import { Effect } from "effect";

/** Loads the only technical Quran row inside one test transaction. */
async function loadRow(ctx: Pick<QueryCtx, "db">) {
  const row = await ctx.db.query("quranRows").unique();
  if (!row) {
    throw new Error("Expected one technical Quran row.");
  }
  return row;
}
describe("contentRelease/quran/verify", () => {
  it.effect("rejects malformed stored signed row envelopes", () =>
    Effect.gen(function* () {
      const t = yield* Confect.pipe(Effect.provide(confectLayer));
      yield* t.run(
        Effect.gen(function* () {
          const tCtx = yield* MutationCtx;
          const snapshotId = yield* Effect.promise(() =>
            activateQuranSnapshot(tCtx, [makeQuranSearch("en", 1)])
          );
          yield* Effect.gen(function* () {
            const row = yield* Effect.promise(() => loadRow(tCtx));
            yield* Effect.promise(() =>
              tCtx.db.patch("quranRows", row._id, {
                rowJson: "{}",
              })
            );
          });
          expect(
            yield* verifyQuranRow(
              yield* Effect.promise(() => loadRow(tCtx)),
              snapshotId,
              QuranSearchRowSchema
            ).pipe(Effect.flip)
          ).toMatchObject({
            code: "CONTENT_RELEASE_INTEGRITY",
          });
        })
      );
    })
  );
  it.effect("rejects a changed signed identity", () =>
    Effect.gen(function* () {
      const signed = yield* Confect.pipe(Effect.provide(confectLayer));
      yield* signed.run(
        Effect.gen(function* () {
          const signedCtx = yield* MutationCtx;
          const signedId = yield* Effect.promise(() =>
            activateQuranSnapshot(signedCtx, [makeQuranSearch("en", 1)])
          );
          yield* Effect.gen(function* () {
            const row = yield* Effect.promise(() => loadRow(signedCtx));
            yield* Effect.promise(() =>
              signedCtx.db.patch("quranRows", row._id, {
                rowHash: `sha256:${"9".repeat(64)}`,
              })
            );
          });
          expect(
            yield* Effect.gen(function* () {
              const row = yield* Effect.promise(() => loadRow(signedCtx));
              return yield* verifyQuranRow(row, signedId, QuranSearchRowSchema);
            }).pipe(Effect.flip)
          ).toMatchObject({
            code: "CONTENT_RELEASE_INTEGRITY",
          });
        })
      );
    })
  );
  it.effect(
    "rejects a payload decoded through another Quran row contract",
    () =>
      Effect.gen(function* () {
        const t = yield* Confect.pipe(Effect.provide(confectLayer));
        yield* t.run(
          Effect.gen(function* () {
            const tCtx = yield* MutationCtx;
            const snapshotId = yield* Effect.promise(() =>
              activateQuranSnapshot(tCtx, [makeQuranSearch("en", 1)])
            );
            expect(
              yield* Effect.gen(function* () {
                const row = yield* Effect.promise(() => loadRow(tCtx));
                return yield* verifyQuranRow(
                  row,
                  snapshotId,
                  QuranSurahRowSchema
                );
              }).pipe(Effect.flip)
            ).toMatchObject({
              code: "CONTENT_RELEASE_INTEGRITY",
            });
          })
        );
      })
  );
  it.effect("rejects indexed facts that drifted from the signed row", () =>
    Effect.gen(function* () {
      const t = yield* Confect.pipe(Effect.provide(confectLayer));
      yield* t.run(
        Effect.gen(function* () {
          const tCtx = yield* MutationCtx;
          const snapshotId = yield* Effect.promise(() =>
            activateQuranSnapshot(tCtx, [makeQuranSearch("en", 1)])
          );
          yield* Effect.gen(function* () {
            const row = yield* Effect.promise(() => loadRow(tCtx));
            yield* Effect.promise(() =>
              tCtx.db.patch("quranRows", row._id, {
                appLocale: "id",
              })
            );
          });
          expect(
            yield* Effect.gen(function* () {
              const row = yield* Effect.promise(() => loadRow(tCtx));
              return yield* verifyQuranRow(
                row,
                snapshotId,
                QuranSearchRowSchema
              );
            }).pipe(Effect.flip)
          ).toMatchObject({
            code: "CONTENT_RELEASE_INTEGRITY",
          });
        })
      );
    })
  );
  it.effect(
    "rejects a replayed row above its aggregate transaction budget",
    () =>
      Effect.gen(function* () {
        const t = yield* Confect.pipe(Effect.provide(confectLayer));
        yield* t.run(
          Effect.gen(function* () {
            const tCtx = yield* MutationCtx;
            const snapshotId = yield* Effect.promise(() =>
              activateQuranSnapshot(tCtx, [makeQuranSearch("en", 1)])
            );
            yield* Effect.gen(function* () {
              const row = yield* Effect.promise(() => loadRow(tCtx));
              yield* Effect.promise(() =>
                tCtx.db.patch("quranRows", row._id, {
                  identity: `search:en:1:${"x".repeat(QURAN_SEARCH_DOCUMENT_LIMIT)}`,
                })
              );
            });
            expect(
              yield* Effect.gen(function* () {
                const row = yield* Effect.promise(() => loadRow(tCtx));
                return yield* verifyQuranRow(
                  row,
                  snapshotId,
                  QuranSearchRowSchema
                );
              }).pipe(Effect.flip)
            ).toMatchObject({
              code: "CONTENT_RELEASE_SIZE",
            });
          })
        );
      })
  );
});
