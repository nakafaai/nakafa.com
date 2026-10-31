import { describe, expect, it } from "@effect/vitest";
import { ContentFamilySchema } from "@nakafa/aksara-contracts/content";
import {
  inheritContentSnapshots,
  replaceContentSnapshot,
} from "@nakafa/aksara-contracts/release/snapshot/spec";
import { MutationCtx } from "@repo/backend/confect/_generated/services";
import {
  validateActivationRenderer,
  validateCandidate,
  validateRecovery,
} from "@repo/backend/confect/contentRelease/activation/validate";
import {
  CURRENT_CONTENT_GENERATION,
  type contentGenerationValidator,
} from "@repo/backend/confect/contentRelease/generation";
import {
  encodeReleaseJson,
  encodeRendererJson,
} from "@repo/backend/confect/contentRelease/wire";
import { Confect, confectLayer } from "@repo/backend/confect/test.setup";
import {
  REPLACEMENT,
  REPLACEMENT_RECOVERY,
  seedReplacementCandidate,
} from "@repo/backend/test/activation/fixture";
import {
  insertActivationPair,
  makeActivationPair,
} from "@repo/backend/test/content/activation";
import { TEST_PROOF_RENDERER } from "@repo/backend/test/content/proof";
import {
  TEST_DIGEST,
  testRendererJson,
} from "@repo/backend/test/content/release";
import {
  insertTestState,
  insertZeroRelease,
} from "@repo/backend/test/content/state";
import { Effect } from "effect";

/** A snapshot-only candidate that rebuilds the program snapshot and upserts no heads. */
const REPLACED_PROGRAM_SNAPSHOTS = {
  ...inheritContentSnapshots(null),
  program: replaceContentSnapshot({
    baseSnapshotId: null,
    resultSnapshotId: TEST_DIGEST,
    rowCount: 1,
    rowDigest: TEST_DIGEST,
  }),
};

/** Seeds a completed candidate as the active release with its retained inverse in the slot, under the given generation. */
async function seedActiveWithRecovery(
  ctx: Parameters<typeof insertTestState>[0],
  generation: typeof CURRENT_CONTENT_GENERATION | null
) {
  await insertZeroRelease(ctx, {
    ...REPLACEMENT,
    ownership: { base: [], result: [] },
    role: "candidate",
    status: "completed",
  });
  await insertZeroRelease(ctx, {
    ...REPLACEMENT_RECOVERY,
    base: REPLACEMENT,
    originReleaseId: REPLACEMENT.releaseId,
    ownership: { base: ContentFamilySchema.literals, result: [] },
    role: "recovery",
    status: "verified",
  });
  await insertTestState(ctx, {
    active: REPLACEMENT,
    generation,
    nextSequence: 4,
    recovery: REPLACEMENT_RECOVERY,
  });
}

describe("activation identity validation", () => {
  it.effect("rejects activation using another manifest identity", () =>
    Effect.gen(function* () {
      const { candidate, recovery } = yield* makeActivationPair();
      const rendererJson = encodeRendererJson(TEST_PROOF_RENDERER);
      expect(
        yield* validateActivationRenderer(
          candidate.manifest.releaseId,
          encodeReleaseJson(candidate),
          rendererJson,
          rendererJson,
          recovery.manifestHash
        ).pipe(Effect.flip)
      ).toMatchObject({
        code: "CONTENT_RELEASE_CONFLICT",
      });
    })
  );
  it.effect(
    "rejects a recovery whose frozen state changed after candidate verification",
    () =>
      Effect.gen(function* () {
        const t = yield* Confect.pipe(Effect.provide(confectLayer));
        yield* t.run(
          Effect.gen(function* () {
            const tCtx = yield* MutationCtx;
            const { candidate, recovery } = yield* makeActivationPair();
            yield* insertActivationPair(tCtx, candidate, recovery);
            const row = yield* Effect.promise(() =>
              tCtx.db
                .query("contentReleases")
                .withIndex("by_releaseId", (q) =>
                  q.eq("releaseId", recovery.manifest.releaseId)
                )
                .unique()
            );
            if (!row) {
              throw new Error("Expected the retained inverse.");
            }
            yield* Effect.promise(() =>
              tCtx.db.patch("contentReleases", row._id, {
                status: "staging",
              })
            );
            expect(
              yield* validateCandidate(
                candidate.manifest.releaseId,
                encodeRendererJson(TEST_PROOF_RENDERER),
                candidate.manifestHash
              ).pipe(Effect.flip)
            ).toMatchObject({
              code: "CONTENT_RELEASE_INTEGRITY",
            });
          })
        );
      })
  );
  it.effect(
    "rejects recovery activation while a candidate still owns its publication slot",
    () =>
      Effect.gen(function* () {
        const t = yield* Confect.pipe(Effect.provide(confectLayer));
        yield* t.run(
          Effect.gen(function* () {
            const tCtx = yield* MutationCtx;
            const { candidate, recovery } = yield* makeActivationPair();
            yield* insertActivationPair(tCtx, candidate, recovery);
            expect(
              yield* validateRecovery(
                recovery.manifest.releaseId,
                encodeRendererJson(TEST_PROOF_RENDERER),
                recovery.manifestHash
              ).pipe(Effect.flip)
            ).toMatchObject({
              code: "CONTENT_RELEASE_STATE",
            });
          })
        );
      })
  );
});

describe("activation candidate validation", () => {
  it.effect(
    "keeps the retained inverse of a candidate over a current generation",
    () =>
      Effect.gen(function* () {
        const t = yield* Confect.pipe(Effect.provide(confectLayer));
        yield* t.run(
          Effect.gen(function* () {
            const tCtx = yield* MutationCtx;
            yield* Effect.promise(() =>
              seedReplacementCandidate(tCtx, {
                generation: CURRENT_CONTENT_GENERATION,
                recovery: true,
              })
            );
            const validated = yield* validateCandidate(
              REPLACEMENT.releaseId,
              testRendererJson(),
              REPLACEMENT.manifestHash
            );
            expect(validated.recovery.releaseId).toBe(
              REPLACEMENT_RECOVERY.releaseId
            );
          })
        );
      })
  );

  it.effect("refuses a candidate that is not verified in its slot", () =>
    Effect.gen(function* () {
      const t = yield* Confect.pipe(Effect.provide(confectLayer));
      yield* t.run(
        Effect.gen(function* () {
          const tCtx = yield* MutationCtx;
          yield* Effect.promise(() =>
            seedReplacementCandidate(tCtx, { generation: null })
          );
          const candidate = yield* Effect.promise(() =>
            tCtx.db
              .query("contentReleases")
              .withIndex("by_releaseId", (query) =>
                query.eq("releaseId", REPLACEMENT.releaseId)
              )
              .unique()
          );
          if (!candidate) {
            throw new Error("Expected the staged candidate.");
          }
          yield* Effect.promise(() =>
            tCtx.db.patch("contentReleases", candidate._id, {
              status: "staging",
            })
          );
          expect(
            yield* validateCandidate(
              REPLACEMENT.releaseId,
              testRendererJson(),
              REPLACEMENT.manifestHash
            ).pipe(Effect.flip)
          ).toMatchObject({
            code: "CONTENT_RELEASE_STATE",
            message: expect.stringContaining("is not the verified candidate"),
          });
        })
      );
    })
  );
});

describe("activation generation guard", () => {
  /** Refuses one recovery activation over an active release recorded under the given generation. */
  const expectRecoveryRefused = (
    generation: typeof contentGenerationValidator.Type | null,
    message: string
  ) =>
    Effect.gen(function* () {
      const t = yield* Confect.pipe(Effect.provide(confectLayer));
      yield* t.run(
        Effect.gen(function* () {
          const tCtx = yield* MutationCtx;
          yield* Effect.promise(() => seedActiveWithRecovery(tCtx, generation));
          expect(
            yield* validateRecovery(
              REPLACEMENT_RECOVERY.releaseId,
              testRendererJson(),
              REPLACEMENT_RECOVERY.manifestHash
            ).pipe(Effect.flip)
          ).toMatchObject({
            code: "CONTENT_RELEASE_STATE",
            message: expect.stringContaining(message),
          });
        })
      );
    });

  it.effect("refuses recovery activation over an unrecorded generation", () =>
    expectRecoveryRefused(null, "is not recorded")
  );

  it.effect("accepts recovery activation over the current generation", () =>
    Effect.gen(function* () {
      const t = yield* Confect.pipe(Effect.provide(confectLayer));
      yield* t.run(
        Effect.gen(function* () {
          const tCtx = yield* MutationCtx;
          yield* Effect.promise(() =>
            seedActiveWithRecovery(tCtx, CURRENT_CONTENT_GENERATION)
          );
          const validated = yield* validateRecovery(
            REPLACEMENT_RECOVERY.releaseId,
            testRendererJson(),
            REPLACEMENT_RECOVERY.manifestHash
          );
          expect(validated.release.releaseId).toBe(
            REPLACEMENT_RECOVERY.releaseId
          );
        })
      );
    })
  );
});
