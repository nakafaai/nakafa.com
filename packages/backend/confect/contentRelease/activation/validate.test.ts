import { describe, expect, it } from "@effect/vitest";
import { ContentFamilySchema } from "@nakafa/aksara-contracts/content";
import {
  inheritContentSnapshot,
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
  RETIRED_CONTENT_GENERATION,
} from "@repo/backend/confect/contentRelease/generation";
import {
  encodeReleaseJson,
  encodeRendererJson,
} from "@repo/backend/confect/contentRelease/wire";
import { Confect, confectLayer } from "@repo/backend/confect/test.setup";
import {
  BOOTSTRAP,
  BOOTSTRAP_RECOVERY,
  seedActiveBootstrap,
  seedRetiredCandidate,
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
import { Effect, Option } from "effect";

/** A candidate that keeps the program snapshot of its retired base, so it cannot replace every snapshot. */
const KEPT_PROGRAM_SNAPSHOTS = {
  ...inheritContentSnapshots(null),
  program: inheritContentSnapshot(TEST_DIGEST),
};

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
  generation:
    | typeof CURRENT_CONTENT_GENERATION
    | typeof RETIRED_CONTENT_GENERATION
    | null
) {
  await insertZeroRelease(ctx, {
    ...BOOTSTRAP,
    ownership: { base: [], result: [] },
    role: "candidate",
    status: "completed",
  });
  await insertZeroRelease(ctx, {
    ...BOOTSTRAP_RECOVERY,
    base: BOOTSTRAP,
    originReleaseId: BOOTSTRAP.releaseId,
    ownership: { base: ContentFamilySchema.literals, result: [] },
    role: "recovery",
    status: "verified",
  });
  await insertTestState(ctx, {
    active: BOOTSTRAP,
    generation,
    nextSequence: 4,
    recovery: BOOTSTRAP_RECOVERY,
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

describe("activation bootstrap validation", () => {
  it.effect("activates a stored bootstrap without a retained inverse", () =>
    Effect.gen(function* () {
      const t = yield* Confect.pipe(Effect.provide(confectLayer));
      yield* t.run(
        Effect.gen(function* () {
          const tCtx = yield* MutationCtx;
          yield* Effect.promise(() =>
            seedRetiredCandidate(tCtx, { bootstrap: true })
          );
          const validated = yield* validateCandidate(
            BOOTSTRAP.releaseId,
            testRendererJson(),
            BOOTSTRAP.manifestHash
          );
          expect(Option.isNone(validated.inverse)).toBe(true);
        })
      );
    })
  );

  it.effect(
    "keeps the retained inverse for an undeclared candidate over a current generation",
    () =>
      Effect.gen(function* () {
        const t = yield* Confect.pipe(Effect.provide(confectLayer));
        yield* t.run(
          Effect.gen(function* () {
            const tCtx = yield* MutationCtx;
            yield* Effect.promise(() =>
              seedRetiredCandidate(tCtx, {
                bootstrap: false,
                generation: CURRENT_CONTENT_GENERATION,
                recovery: true,
              })
            );
            const validated = yield* validateCandidate(
              BOOTSTRAP.releaseId,
              testRendererJson(),
              BOOTSTRAP.manifestHash
            );
            expect(
              Option.getOrUndefined(validated.inverse)?.recovery.releaseId
            ).toBe(BOOTSTRAP_RECOVERY.releaseId);
          })
        );
      })
  );

  it.effect.each([
    {
      message: "no longer meets the bootstrap contract",
      name: "a stored bootstrap once a recovery is staged",
      options: { bootstrap: true, recovery: true },
    },
    {
      message: "no longer meets the bootstrap contract",
      name: "a stored bootstrap over a current generation",
      options: { bootstrap: true, generation: CURRENT_CONTENT_GENERATION },
    },
    {
      message: "lacks a verified retained recovery",
      name: "an undeclared candidate over the retired generation without a recovery",
      options: { bootstrap: false },
    },
    {
      message: "extends a retired content generation",
      name: "an undeclared candidate over the retired generation with an inverse",
      options: { bootstrap: false, recovery: true },
    },
    {
      message: "is not recorded",
      name: "an undeclared candidate over an unrecorded generation with an inverse",
      options: { bootstrap: false, generation: null, recovery: true },
    },
    {
      message: "extends a retired content generation",
      name: "a snapshot-only candidate over the retired generation with an inverse",
      options: {
        bootstrap: false,
        recovery: true,
        snapshots: REPLACED_PROGRAM_SNAPSHOTS,
      },
    },
    {
      message: "no longer meets the bootstrap contract",
      name: "a stored bootstrap that keeps a base snapshot",
      options: { bootstrap: true, snapshots: KEPT_PROGRAM_SNAPSHOTS },
    },
  ])("refuses $name", ({ message, options }) =>
    Effect.gen(function* () {
      const t = yield* Confect.pipe(Effect.provide(confectLayer));
      yield* t.run(
        Effect.gen(function* () {
          const tCtx = yield* MutationCtx;
          yield* Effect.promise(() => seedRetiredCandidate(tCtx, options));
          expect(
            yield* validateCandidate(
              BOOTSTRAP.releaseId,
              testRendererJson(),
              BOOTSTRAP.manifestHash
            ).pipe(Effect.flip)
          ).toMatchObject({
            code: "CONTENT_RELEASE_STATE",
            message: expect.stringContaining(message),
          });
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
            seedRetiredCandidate(tCtx, { bootstrap: true })
          );
          const candidate = yield* Effect.promise(() =>
            tCtx.db
              .query("contentReleases")
              .withIndex("by_releaseId", (query) =>
                query.eq("releaseId", BOOTSTRAP.releaseId)
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
              BOOTSTRAP.releaseId,
              testRendererJson(),
              BOOTSTRAP.manifestHash
            ).pipe(Effect.flip)
          ).toMatchObject({
            code: "CONTENT_RELEASE_STATE",
            message: expect.stringContaining("is not the verified candidate"),
          });
        })
      );
    })
  );

  it.effect("refuses recovery over an active bootstrap", () =>
    Effect.gen(function* () {
      const t = yield* Confect.pipe(Effect.provide(confectLayer));
      yield* t.run(
        Effect.gen(function* () {
          const tCtx = yield* MutationCtx;
          yield* Effect.promise(() => seedActiveBootstrap(tCtx));
          expect(
            yield* validateRecovery(
              BOOTSTRAP_RECOVERY.releaseId,
              testRendererJson(),
              BOOTSTRAP_RECOVERY.manifestHash
            ).pipe(Effect.flip)
          ).toMatchObject({
            code: "CONTENT_RELEASE_UNSUPPORTED",
            message: expect.stringContaining(
              "Publish a new release instead of rolling back across the contract change"
            ),
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
              BOOTSTRAP_RECOVERY.releaseId,
              testRendererJson(),
              BOOTSTRAP_RECOVERY.manifestHash
            ).pipe(Effect.flip)
          ).toMatchObject({
            code: "CONTENT_RELEASE_STATE",
            message: expect.stringContaining(message),
          });
        })
      );
    });

  it.effect("refuses recovery activation over a retired generation", () =>
    expectRecoveryRefused(
      RETIRED_CONTENT_GENERATION,
      "retired content generation"
    )
  );

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
            BOOTSTRAP_RECOVERY.releaseId,
            testRendererJson(),
            BOOTSTRAP_RECOVERY.manifestHash
          );
          expect(validated.release.releaseId).toBe(
            BOOTSTRAP_RECOVERY.releaseId
          );
        })
      );
    })
  );
});
