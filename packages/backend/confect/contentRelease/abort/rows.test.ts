import { afterEach, assert, describe, expect, it } from "@effect/vitest";
import { MutationCtx } from "@repo/backend/confect/_generated/services";
import {
  deleteAbortRows,
  hasAbortResidue,
} from "@repo/backend/confect/contentRelease/abort/rows";
import { Confect, confectLayer } from "@repo/backend/confect/test.setup";
import {
  ABORT_ITEM_COUNT,
  ABORT_RELEASE_ID,
  seedAbortRelease,
} from "@repo/backend/test/content/abort";
import { insertTestHead } from "@repo/backend/test/content/head";
import { TEST_DIGEST } from "@repo/backend/test/content/release";
import { Effect } from "effect";

describe("bounded release row abort", () => {
  afterEach(() => vi.restoreAllMocks());
  it.effect(
    "preserves directory identities created by another sequence and tolerates already-removed keys",
    () =>
      Effect.gen(function* () {
        const t = yield* Confect.pipe(Effect.provide(confectLayer));
        yield* t.run(
          Effect.gen(function* () {
            const tCtx = yield* MutationCtx;
            yield* Effect.promise(() => seedAbortRelease(tCtx));
            const [foreign, removed] = yield* Effect.promise(() =>
              tCtx.db.query("contentKeys").take(2)
            );
            assert(foreign && removed);
            yield* Effect.promise(() =>
              tCtx.db.patch("contentKeys", foreign._id, {
                createdSequence: 2,
              })
            );
            yield* Effect.promise(() =>
              tCtx.db.delete("contentKeys", removed._id)
            );
            const foreignKey = foreign.contentKey;
            expect(yield* deleteAbortRows(ABORT_RELEASE_ID, 1)).toBe(
              ABORT_ITEM_COUNT
            );
            expect(
              yield* Effect.promise(() =>
                tCtx.db.query("contentKeys").collect()
              )
            ).toMatchObject([
              {
                contentKey: foreignKey,
                createdSequence: 2,
              },
            ]);
            expect(yield* hasAbortResidue(1)).toBe(false);
          })
        );
      })
  );
  it.effect(
    "removes binding rows without claiming foreign or missing public paths",
    () =>
      Effect.gen(function* () {
        const t = yield* Confect.pipe(Effect.provide(confectLayer));
        yield* t.run(
          Effect.gen(function* () {
            const tCtx = yield* MutationCtx;
            yield* Effect.promise(() =>
              tCtx.db.insert("contentPaths", {
                appLocale: "en",
                publicPath: "test/foreign",
                createdSequence: 2,
              })
            );
            yield* Effect.forEach(
              ["test/foreign", "test/absent"],
              (publicPath, index) =>
                Effect.promise(() =>
                  tCtx.db.insert("contentBindings", {
                    appLocale: "en",
                    batchHash: TEST_DIGEST,
                    batchIndex: 0,
                    index,
                    operation: "delete",
                    publicPath,
                    releaseId: ABORT_RELEASE_ID,
                    routeJson: "{}",
                    sequence: 1,
                  })
                ),
              { discard: true }
            );
            expect(yield* deleteAbortRows(ABORT_RELEASE_ID, 1)).toBe(2);
            expect(
              yield* Effect.promise(() =>
                tCtx.db.query("contentPaths").collect()
              )
            ).toMatchObject([
              {
                publicPath: "test/foreign",
                createdSequence: 2,
              },
            ]);
            expect(
              yield* Effect.promise(() =>
                tCtx.db.query("contentBindings").collect()
              )
            ).toEqual([]);
          })
        );
      })
  );
  it.effect(
    "deletes tombstone heads without inventing artifact ownership",
    () =>
      Effect.gen(function* () {
        const t = yield* Confect.pipe(Effect.provide(confectLayer));
        yield* t.run(
          Effect.gen(function* () {
            const tCtx = yield* MutationCtx;
            yield* Effect.promise(() =>
              insertTestHead(tCtx, {
                contentKey: "test:tombstone",
                operation: "delete",
                releaseId: ABORT_RELEASE_ID,
              })
            );
            expect(yield* deleteAbortRows(ABORT_RELEASE_ID, 1)).toBe(1);
            expect(
              yield* Effect.promise(() =>
                tCtx.db.query("contentHeads").collect()
              )
            ).toEqual([]);
          })
        );
      })
  );
  it.effect(
    "stops a snapshot batch page at measured write headroom and resumes the remaining rows",
    () =>
      Effect.gen(function* () {
        const t = yield* Confect.pipe(Effect.provide(confectLayer));
        yield* t.run(
          Effect.gen(function* () {
            const tCtx = yield* MutationCtx;
            for (let batchIndex = 0; batchIndex < 3; batchIndex += 1) {
              yield* Effect.promise(() =>
                tCtx.db.insert("snapshotBatches", {
                  batchHash: TEST_DIGEST,
                  batchIndex,
                  createdAt: 0,
                  family: "program",
                  firstIndex: batchIndex,
                  releaseId: ABORT_RELEASE_ID,
                  rowCount: 1,
                  sequence: 1,
                  snapshotId: TEST_DIGEST,
                })
              );
            }
            const metrics = yield* Effect.promise(() =>
              tCtx.meta.getTransactionMetrics()
            );
            const inspection = vi
              .spyOn(tCtx.meta, "getTransactionMetrics")
              .mockResolvedValue({
                ...metrics,
                bytesWritten: {
                  ...metrics.bytesWritten,
                  remaining: 0,
                },
              });
            const first = yield* deleteAbortRows(ABORT_RELEASE_ID, 1);
            inspection.mockRestore();
            expect(first).toBe(1);
            expect(
              yield* Effect.promise(() =>
                tCtx.db.query("snapshotBatches").collect()
              )
            ).toHaveLength(2);
          })
        );
        yield* t.run(
          Effect.gen(function* () {
            expect(yield* deleteAbortRows(ABORT_RELEASE_ID, 1)).toBe(2);
          })
        );
        yield* t.run(
          Effect.gen(function* () {
            expect(yield* deleteAbortRows(ABORT_RELEASE_ID, 1)).toBe(0);
          })
        );
      })
  );
});
