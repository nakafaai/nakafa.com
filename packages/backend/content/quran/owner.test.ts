import { describe, expect, it } from "@effect/vitest";
import { ReleaseIdSchema } from "@nakafa/aksara-contracts/ids";
import { MutationCtx } from "@repo/backend/confect/_generated/services";
import { Confect, confectLayer } from "@repo/backend/confect/test.setup";
import { quranLayer } from "@repo/backend/content/quran/confect";
import { loadQuranOwner } from "@repo/backend/content/quran/owner";
import {
  TEST_MANIFEST_HASH,
  TEST_RELEASE_ID,
  testReleaseJson,
} from "@repo/backend/test/content/release";
import { makeQuranSurah } from "@repo/backend/test/quran/rows";
import {
  activateQuranSnapshot,
  activateQuranSource,
} from "@repo/backend/test/quran/snapshot";
import { Effect } from "effect";

describe("contentRelease/quran/owner", () => {
  it.effect(
    "preserves the active release while Quran remains source-owned",
    () =>
      Effect.gen(function* () {
        const t = yield* Confect.pipe(Effect.provide(confectLayer));
        yield* t.run(
          Effect.gen(function* () {
            const tCtx = yield* MutationCtx;
            yield* Effect.promise(() => activateQuranSource(tCtx));
            expect(
              yield* loadQuranOwner().pipe(Effect.provide(quranLayer))
            ).toEqual({
              activeManifestHash: TEST_MANIFEST_HASH,
              activeReleaseId: TEST_RELEASE_ID,
              managed: false,
              snapshotId: null,
              sourceOrigin: null,
              sourceRevision: null,
            });
          })
        );
      })
  );
  it.effect(
    "tracks an active release change without claiming Quran ownership",
    () =>
      Effect.gen(function* () {
        const nextReleaseId = ReleaseIdSchema.make("release-next");
        const t = yield* Confect.pipe(Effect.provide(confectLayer));
        yield* t.run(
          Effect.gen(function* () {
            const tCtx = yield* MutationCtx;
            yield* Effect.promise(() => activateQuranSource(tCtx));
            yield* Effect.gen(function* () {
              const [release, state] = yield* Effect.promise(() =>
                Promise.all([
                  tCtx.db.query("contentReleases").unique(),
                  tCtx.db.query("contentState").unique(),
                ])
              );
              if (!(release && state)) {
                throw new Error("Expected one active source release.");
              }
              yield* Effect.promise(() =>
                tCtx.db.patch("contentReleases", release._id, {
                  releaseId: nextReleaseId,
                  releaseJson: testReleaseJson({
                    releaseId: nextReleaseId,
                  }),
                  sequence: 2,
                })
              );
              yield* Effect.promise(() =>
                tCtx.db.patch("contentState", state._id, {
                  activeReleaseId: nextReleaseId,
                  activeSequence: 2,
                })
              );
            });
            expect(
              yield* loadQuranOwner().pipe(Effect.provide(quranLayer))
            ).toMatchObject({
              activeReleaseId: nextReleaseId,
              managed: false,
              snapshotId: null,
            });
          })
        );
      })
  );
  it.effect("selects one approved active Quran snapshot", () =>
    Effect.gen(function* () {
      const empty = yield* Confect.pipe(Effect.provide(confectLayer));
      yield* empty.run(
        Effect.gen(function* () {
          expect(
            yield* loadQuranOwner().pipe(Effect.provide(quranLayer))
          ).toEqual({
            activeManifestHash: null,
            activeReleaseId: null,
            managed: false,
            snapshotId: null,
            sourceOrigin: null,
            sourceRevision: null,
          });
          const active = yield* Confect.pipe(Effect.provide(confectLayer));
          yield* active.run(
            Effect.gen(function* () {
              const activeCtx = yield* MutationCtx;
              const snapshotId = yield* Effect.promise(() =>
                activateQuranSnapshot(activeCtx, [makeQuranSurah(1)])
              );
              expect(
                yield* loadQuranOwner().pipe(Effect.provide(quranLayer))
              ).toMatchObject({
                activeReleaseId: TEST_RELEASE_ID,
                managed: true,
                snapshotId,
                sourceOrigin: {
                  kind: "git",
                  sha: expect.any(String),
                },
                sourceRevision: expect.any(String),
              });
            })
          );
        })
      );
    })
  );
  it.effect(
    "preserves the exact signed rollback origin for an active snapshot",
    () =>
      Effect.gen(function* () {
        const t = yield* Confect.pipe(Effect.provide(confectLayer));
        yield* t.run(
          Effect.gen(function* () {
            const tCtx = yield* MutationCtx;
            const originReleaseId = ReleaseIdSchema.make(
              "release-quran-origin"
            );
            const snapshotId = yield* Effect.promise(() =>
              activateQuranSnapshot(tCtx, [makeQuranSurah(1)], {
                originReleaseId,
              })
            );
            expect(
              yield* loadQuranOwner().pipe(Effect.provide(quranLayer))
            ).toMatchObject({
              activeReleaseId: TEST_RELEASE_ID,
              managed: true,
              snapshotId,
              sourceOrigin: {
                kind: "rollback",
                releaseId: originReleaseId,
              },
              sourceRevision: null,
            });
          })
        );
      })
  );
});
