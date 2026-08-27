import {
  afterEach,
  assert,
  beforeEach,
  describe,
  it,
  vi,
} from "@effect/vitest";
import { ContentFamilySchema } from "@nakafa/aksara-contracts/content";
import { invertContentSnapshots } from "@nakafa/aksara-contracts/release/snapshot/spec";
import { internal } from "@repo/backend/convex/_generated/api";
import { decodeTryoutRuntimeBundleJson } from "@repo/backend/convex/contentRelease/parse";
import { readConvexErrorData } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  BASE,
  CANDIDATE,
  expectedReceipt,
  makeActivationRuntime,
  RECOVERY,
  seedVerifiedPair,
} from "@repo/backend/test/activation/fixture";
import { testRendererJson } from "@repo/backend/test/content/release";
import {
  insertZeroRelease,
  type TestIdentity,
} from "@repo/backend/test/content/state";
import { storeRuntimeFixture } from "@repo/backend/test/runtime/bundle";
import { convexTest } from "convex-test";
import { Effect } from "effect";

const activate = internal.contentRelease.activate.activate;
const activateRecovery = internal.contentRelease.activate.activateRecovery;
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

/** Creates and stores the distinct result and retained-base runtime pairs. */
const seedRuntimePair = Effect.fn("test.recovery.seedRuntimePair")(
  function* () {
    const result = yield* makeActivationRuntime({ hasBaseSnapshot: true });
    const retainedBase = yield* makeActivationRuntime({
      bundleSnapshot: "base",
      hasBaseSnapshot: true,
    });
    const snapshots = result.release.manifest.snapshots;
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
    yield* storeRuntimeFixture(t, result);
    yield* storeRuntimeFixture(t, retainedBase);
    return { result, retainedBase, snapshots, t };
  }
);

/** Captures an expected rejected Convex operation in the Effect error channel. */
function rejected<A>(operation: () => Promise<A>) {
  return Effect.tryPromise(operation).pipe(
    Effect.flip,
    Effect.map((error) => error.cause)
  );
}

describe("contentRelease/recovery", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it.effect("activates the retained base with the current renderer", () =>
    Effect.gen(function* () {
      const { retainedBase, snapshots, t } = yield* seedRuntimePair();
      yield* Effect.promise(() =>
        t.mutation(activate, {
          manifestHash: CANDIDATE.manifestHash,
          releaseId: CANDIDATE.releaseId,
          rendererJson: testRendererJson(),
        })
      );
      yield* Effect.promise(() =>
        t.finishAllScheduledFunctions(vi.runAllTimers)
      );

      const activation = yield* Effect.promise(() =>
        t.mutation(activateRecovery, {
          manifestHash: RECOVERY.manifestHash,
          releaseId: RECOVERY.releaseId,
          rendererJson: testRendererJson(),
        })
      );
      yield* Effect.promise(() =>
        t.finishAllScheduledFunctions(vi.runAllTimers)
      );
      const [state, publication] = yield* Effect.all([
        Effect.promise(() =>
          t.run((ctx) => ctx.db.query("contentState").unique())
        ),
        Effect.promise(() => t.query(current, {})),
      ]);

      assert.strictEqual(
        JSON.stringify(activation),
        JSON.stringify({
          kind: "activated",
          receipt: expectedReceipt(RECOVERY, invertContentSnapshots(snapshots)),
        })
      );
      assert.ok(state);
      assert.strictEqual(state.activeManifestHash, RECOVERY.manifestHash);
      assert.strictEqual(state.activeReleaseId, RECOVERY.releaseId);
      assert.strictEqual(state.activeSequence, RECOVERY.sequence);
      assert.strictEqual(state.recoveryReleaseId, undefined);
      const runtime = yield* decodeTryoutRuntimeBundleJson(
        publication.tryoutRuntimeBundleJson ?? ""
      );
      assert.strictEqual(runtime.bundleHash, retainedBase.bundle.bundleHash);
    })
  );

  it.effect("looks up completed recovery without the candidate runtime", () =>
    Effect.gen(function* () {
      const { result, retainedBase, t } = yield* seedRuntimePair();
      yield* Effect.promise(() =>
        t.mutation(activate, {
          manifestHash: CANDIDATE.manifestHash,
          releaseId: CANDIDATE.releaseId,
          rendererJson: testRendererJson(),
        })
      );
      yield* Effect.promise(() =>
        t.finishAllScheduledFunctions(vi.runAllTimers)
      );
      yield* Effect.promise(() =>
        t.mutation(activateRecovery, {
          manifestHash: RECOVERY.manifestHash,
          releaseId: RECOVERY.releaseId,
          rendererJson: testRendererJson(),
        })
      );
      yield* Effect.promise(() =>
        t.finishAllScheduledFunctions(vi.runAllTimers)
      );
      yield* Effect.promise(() =>
        t.mutation(async (ctx) => {
          const candidateRuntime = await ctx.db
            .query("tryoutRuntimeBundles")
            .withIndex("by_bundleHash", (index) =>
              index.eq("bundleHash", result.bundle.bundleHash)
            )
            .unique();
          if (!candidateRuntime) {
            throw new Error("Expected one candidate runtime bundle.");
          }
          await ctx.db.delete("tryoutRuntimeBundles", candidateRuntime._id);
        })
      );

      const recovered = yield* Effect.promise(() =>
        t.query(lookup, {
          recoveryId: RECOVERY.releaseId,
          releaseId: CANDIDATE.releaseId,
        })
      );

      assert.strictEqual(recovered.kind, "completed");

      yield* Effect.promise(() =>
        t.mutation(async (ctx) => {
          const recoveryRuntime = await ctx.db
            .query("tryoutRuntimeBundles")
            .withIndex("by_bundleHash", (index) =>
              index.eq("bundleHash", retainedBase.bundle.bundleHash)
            )
            .unique();
          if (!recoveryRuntime) {
            throw new Error("Expected one recovery runtime bundle.");
          }
          await ctx.db.delete("tryoutRuntimeBundles", recoveryRuntime._id);
        })
      );
      const failure = yield* rejected(() =>
        t.query(lookup, {
          recoveryId: RECOVERY.releaseId,
          releaseId: CANDIDATE.releaseId,
        })
      );
      assert.strictEqual(
        readConvexErrorData(failure)?.code,
        "CONTENT_RELEASE_INTEGRITY"
      );
    })
  );

  it.effect("keeps recovery invisible when its permanent pair disappears", () =>
    Effect.gen(function* () {
      const { retainedBase, t } = yield* seedRuntimePair();
      yield* Effect.promise(() =>
        t.mutation(activate, {
          manifestHash: CANDIDATE.manifestHash,
          releaseId: CANDIDATE.releaseId,
          rendererJson: testRendererJson(),
        })
      );
      yield* Effect.promise(() =>
        t.mutation(async (ctx) => {
          const stored = await ctx.db
            .query("tryoutRuntimeBundles")
            .withIndex("by_bundleHash", (index) =>
              index.eq("bundleHash", retainedBase.bundle.bundleHash)
            )
            .unique();
          if (!stored) {
            throw new Error("Expected one retained-base runtime bundle.");
          }
          await ctx.db.delete("tryoutRuntimeBundles", stored._id);
        })
      );

      const failure = yield* rejected(() =>
        t.mutation(activateRecovery, {
          manifestHash: RECOVERY.manifestHash,
          releaseId: RECOVERY.releaseId,
          rendererJson: testRendererJson(),
        })
      );
      assert.strictEqual(
        readConvexErrorData(failure)?.code,
        "CONTENT_RELEASE_INTEGRITY"
      );
      const state = yield* Effect.promise(() =>
        t.run((ctx) => ctx.db.query("contentState").unique())
      );
      assert.ok(state);
      assert.strictEqual(state.activeReleaseId, CANDIDATE.releaseId);
      assert.strictEqual(state.recoveryReleaseId, RECOVERY.releaseId);
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
      assert.deepStrictEqual(absentResult, { kind: "missing" });

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
      assert.deepStrictEqual(retainedResult, { kind: "missing" });
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

  it.effect("rejects completed recovery with unrelated provenance", () =>
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
            originReleaseId: "release-other",
            ownership: {
              base: ContentFamilySchema.literals,
              result: [],
            },
            role: "recovery",
            status: "completed",
          });
        })
      );

      const failure = yield* rejected(() =>
        t.query(lookup, {
          recoveryId: LOOKUP_RECOVERY.releaseId,
          releaseId: LOOKUP_BASE.releaseId,
        })
      );
      assert.strictEqual(
        readConvexErrorData(failure)?.code,
        "CONTENT_RELEASE_INTEGRITY"
      );
    })
  );
});
