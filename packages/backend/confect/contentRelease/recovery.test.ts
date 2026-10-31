import { Ref } from "@confect/core";
import { afterEach, assert, beforeEach, describe, it } from "@effect/vitest";
import { ContentFamilySchema } from "@nakafa/aksara-contracts/content";
import {
  inheritContentSnapshots,
  invertContentSnapshots,
} from "@nakafa/aksara-contracts/release/snapshot/spec";
import { activationResultValidator } from "@repo/backend/confect/contentRelease/activation/spec";
import { ReleaseError } from "@repo/backend/confect/contentRelease/error";
import { CURRENT_CONTENT_GENERATION } from "@repo/backend/confect/contentRelease/generation";
import { convexModules } from "@repo/backend/confect/test.setup";
import { internal } from "@repo/backend/convex/_generated/api";
import schema from "@repo/backend/convex/schema";
import {
  BASE,
  CANDIDATE,
  expectedReceipt,
  RECOVERY,
  seedVerifiedPair,
} from "@repo/backend/test/activation/fixture";
import { testRendererJson } from "@repo/backend/test/content/release";
import {
  insertZeroRelease,
  patchStoredOriginRelease,
  type TestIdentity,
} from "@repo/backend/test/content/state";
import { convexTest } from "convex-test";
import { Array as Arr, Effect, Schema } from "effect";

const activate = internal.contentRelease.activate.activate;
const activateRecovery = internal.contentRelease.activate.activateRecovery;
const prepare = internal.contentRelease.activate.prepare;
const prepareRecovery = internal.contentRelease.activate.prepareRecovery;
const current = internal.contentRelease.status.current;
const lookup = internal.contentRelease.recovery.lookup;
const LOOKUP_BASE = {
  manifestHash: `sha256:${"3".repeat(64)}`,
  releaseId: "release-recovery-base",
  sequence: 1,
} satisfies TestIdentity;
const LOOKUP_RECOVERY = {
  manifestHash: `sha256:${"4".repeat(64)}`,
  releaseId: "release-recovery-lookup",
  sequence: 2,
} satisfies TestIdentity;
const ActivationResultJsonSchema = Schema.fromJsonString(
  activationResultValidator
);
const encodeActivation = Schema.encodeSync(ActivationResultJsonSchema);

/** Seeds a verified candidate over the active base and its exact inverse. */
const seedPair = Effect.fn("test.recovery.seedPair")(function* () {
  const snapshots = inheritContentSnapshots(null);
  const t = convexTest(schema, convexModules);
  yield* Effect.promise(() =>
    t.mutation((ctx) =>
      seedVerifiedPair(ctx, {
        base: BASE,
        candidate: snapshots,
        recovery: invertContentSnapshots(snapshots),
      })
    )
  );
  return { snapshots, t };
});

/** Captures an expected rejected Convex operation in the Effect error channel. */
function rejected<A>(operation: () => Promise<A>) {
  return Effect.tryPromise(operation).pipe(
    Effect.flip,
    Effect.map((error) => error.cause)
  );
}

/** Prepares invisible buffers before atomically activating the candidate. */
async function activateCandidate(t: ReturnType<typeof convexTest>) {
  const args = {
    manifestHash: CANDIDATE.manifestHash,
    releaseId: CANDIDATE.releaseId,
    rendererJson: testRendererJson(),
  };
  await t.mutation(prepare, args);
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  return t.mutation(activate, args);
}

/** Prepares invisible buffers before atomically activating the recovery. */
async function recoverCandidate(t: ReturnType<typeof convexTest>) {
  const args = {
    manifestHash: RECOVERY.manifestHash,
    releaseId: RECOVERY.releaseId,
    rendererJson: testRendererJson(),
  };
  await t.mutation(prepareRecovery, args);
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  return t.mutation(activateRecovery, args);
}
describe("contentRelease/recovery", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());
  it.effect(
    "queues the build of the section index once, in the transaction that makes the recovery active",
    () =>
      Effect.gen(function* () {
        const { t } = yield* seedPair();
        /** The releases that section builds were queued for, in order. */
        const queued = () =>
          t.run(async (ctx) =>
            Arr.map(
              Arr.filter(
                await ctx.db.system.query("_scheduled_functions").collect(),
                ({ name }) => name === "contents/sections/build:run"
              ),
              ({ args }) => args
            )
          );
        yield* Effect.promise(() => activateCandidate(t));
        yield* Effect.promise(() => recoverCandidate(t));
        assert.deepStrictEqual(yield* Effect.promise(queued), [
          [{ releaseId: CANDIDATE.releaseId }],
          [{ releaseId: RECOVERY.releaseId }],
        ]);
        // Activating the same recovery again finds it completed and queues nothing.
        yield* Effect.promise(() =>
          t.mutation(activateRecovery, {
            manifestHash: RECOVERY.manifestHash,
            releaseId: RECOVERY.releaseId,
            rendererJson: testRendererJson(),
          })
        );
        assert.deepStrictEqual(yield* Effect.promise(queued), [
          [{ releaseId: CANDIDATE.releaseId }],
          [{ releaseId: RECOVERY.releaseId }],
        ]);
      })
  );
  it.effect("activates the retained base with the current renderer", () =>
    Effect.gen(function* () {
      const { snapshots, t } = yield* seedPair();
      yield* Effect.promise(() => activateCandidate(t));
      const activation = yield* Effect.promise(() => recoverCandidate(t));
      const [state, publication] = yield* Effect.all([
        Effect.promise(() =>
          t.run((ctx) => ctx.db.query("contentState").unique())
        ),
        Effect.promise(() => t.query(current, {})),
      ]);
      assert.strictEqual(
        encodeActivation(activation, { onExcessProperty: "error" }),
        encodeActivation(
          {
            kind: "activated",
            receipt: expectedReceipt(
              RECOVERY,
              invertContentSnapshots(snapshots)
            ),
          },
          { onExcessProperty: "error" }
        )
      );
      assert.ok(state);
      assert.strictEqual(state.activeManifestHash, RECOVERY.manifestHash);
      assert.strictEqual(state.activeReleaseId, RECOVERY.releaseId);
      assert.strictEqual(state.activeSequence, RECOVERY.sequence);
      assert.strictEqual(state.recoveryReleaseId, undefined);
      assert.strictEqual(
        state.activeContentGeneration,
        CURRENT_CONTENT_GENERATION
      );
      assert.strictEqual(
        publication.active?.receipt.releaseId,
        RECOVERY.releaseId
      );
    })
  );
  it.effect("looks up the completed recovery of the active candidate", () =>
    Effect.gen(function* () {
      const { t } = yield* seedPair();
      yield* Effect.promise(() => activateCandidate(t));
      yield* Effect.promise(() => recoverCandidate(t));
      const recovered = yield* Effect.promise(() =>
        t.query(lookup, {
          recoveryId: RECOVERY.releaseId,
          releaseId: CANDIDATE.releaseId,
        })
      );
      assert.strictEqual(recovered.kind, "completed");
    })
  );
  it.effect("returns missing for absent and noncompleted recovery", () =>
    Effect.gen(function* () {
      const absent = convexTest(schema, convexModules);
      const absentResult = yield* Effect.promise(() =>
        absent.query(lookup, {
          recoveryId: LOOKUP_RECOVERY.releaseId,
          releaseId: LOOKUP_BASE.releaseId,
        })
      );
      assert.deepStrictEqual(absentResult, {
        kind: "missing",
      });
      const retained = convexTest(schema, convexModules);
      yield* Effect.promise(() =>
        retained.mutation((ctx) =>
          insertZeroRelease(ctx, {
            ...LOOKUP_RECOVERY,
            base: LOOKUP_BASE,
            originReleaseId: LOOKUP_BASE.releaseId,
            ownership: {
              base: ContentFamilySchema.literals,
              result: [],
            },
            role: "recovery",
            status: "verified",
          })
        )
      );
      const retainedResult = yield* Effect.promise(() =>
        retained.query(lookup, {
          recoveryId: LOOKUP_RECOVERY.releaseId,
          releaseId: LOOKUP_BASE.releaseId,
        })
      );
      assert.deepStrictEqual(retainedResult, {
        kind: "missing",
      });
    })
  );
  it.effect(
    "returns exact completed recovery after later state advancement",
    () =>
      Effect.gen(function* () {
        const t = convexTest(schema, convexModules);
        yield* Effect.promise(() =>
          t.mutation(async (ctx) => {
            await insertZeroRelease(ctx, {
              ...LOOKUP_BASE,
              ownership: {
                base: [],
                result: ContentFamilySchema.literals,
              },
              role: "candidate",
              status: "completed",
            });
            await insertZeroRelease(ctx, {
              ...LOOKUP_RECOVERY,
              base: LOOKUP_BASE,
              originReleaseId: LOOKUP_BASE.releaseId,
              ownership: {
                base: ContentFamilySchema.literals,
                result: [],
              },
              role: "recovery",
              status: "completed",
            });
          })
        );
        const result = yield* Effect.promise(() =>
          t.query(lookup, {
            recoveryId: LOOKUP_RECOVERY.releaseId,
            releaseId: LOOKUP_BASE.releaseId,
          })
        );
        assert.strictEqual(result.kind, "completed");
        if (result.kind === "completed") {
          assert.strictEqual(
            result.value.receipt.releaseId,
            LOOKUP_RECOVERY.releaseId
          );
        }
      })
  );
  it.effect.each(["origin", "base"])(
    "rejects completed recovery with unrelated %s",
    (drift) =>
      Effect.gen(function* () {
        const t = convexTest(schema, convexModules);
        yield* Effect.promise(() =>
          t.mutation(async (ctx) => {
            await insertZeroRelease(ctx, {
              ...LOOKUP_BASE,
              manifestHash:
                drift === "base"
                  ? `sha256:${"5".repeat(64)}`
                  : LOOKUP_BASE.manifestHash,
              ownership: {
                base: [],
                result: ContentFamilySchema.literals,
              },
              role: "candidate",
              status: "completed",
            });
            await insertZeroRelease(ctx, {
              ...LOOKUP_RECOVERY,
              base: LOOKUP_BASE,
              originReleaseId: LOOKUP_BASE.releaseId,
              ownership: {
                base: ContentFamilySchema.literals,
                result: [],
              },
              role: "recovery",
              status: "completed",
            });
            if (drift === "origin") {
              await patchStoredOriginRelease(
                ctx,
                LOOKUP_RECOVERY.releaseId,
                "release-other"
              );
            }
          })
        );
        const failure = yield* rejected(() =>
          t.query(lookup, {
            recoveryId: LOOKUP_RECOVERY.releaseId,
            releaseId: LOOKUP_BASE.releaseId,
          })
        );
        assert(Ref.isConvexError(failure));
        assert.strictEqual(
          (yield* Schema.decodeUnknownEffect(ReleaseError)(failure.data)).code,
          "CONTENT_RELEASE_INTEGRITY"
        );
      })
  );
});
