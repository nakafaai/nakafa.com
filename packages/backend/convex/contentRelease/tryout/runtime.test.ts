import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import {
  inheritContentSnapshot,
  inheritContentSnapshots,
  invertContentSnapshots,
} from "@nakafa/aksara-contracts/release/snapshot/spec";
import { internal } from "@repo/backend/convex/_generated/api";
import { reconcileTryoutRuntimeAfterAttempt } from "@repo/backend/convex/contentRelease/tryout/runtime";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  BASE,
  CANDIDATE,
  makeActivationRuntime,
  seedVerifiedPair,
} from "@repo/backend/test/activation/fixture";
import { testRendererJson } from "@repo/backend/test/content/release";
import { storeRuntimeFixture } from "@repo/backend/test/runtime/bundle";
import {
  insertRetentionAttempt,
  RETENTION_BASE_SNAPSHOT,
  RETENTION_NEWER_SNAPSHOT,
  RETENTION_OTHER_SNAPSHOT,
  RETENTION_RELEASE_ID,
  RETENTION_RESULT_SNAPSHOT,
  readRuntimeRetention,
  seedRuntimeRetentionRow,
} from "@repo/backend/test/runtime/retention";
import { convexTest } from "convex-test";
import { Effect } from "effect";

const activate = internal.contentRelease.activate.activate;
const prepare = internal.contentRelease.activate.prepare;
const current = internal.contentRelease.status.current;

/** Runs the exact candidate activation request used by every runtime gate. */
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

describe("contentRelease/tryout runtime activation", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it.effect("keeps a candidate invisible without its result pair", () =>
    Effect.gen(function* () {
      const t = convexTest(schema, convexModules);
      const fixture = yield* makeActivationRuntime();
      const snapshots = fixture.release.manifest.snapshots;
      yield* Effect.promise(() =>
        t.mutation((ctx) =>
          seedVerifiedPair(ctx, {
            candidate: snapshots,
            recovery: invertContentSnapshots(snapshots),
          })
        )
      );

      yield* Effect.promise(() =>
        expect(activateCandidate(t)).rejects.toMatchObject({
          data: { code: "CONTENT_RELEASE_INTEGRITY" },
        })
      );
      const unchanged = yield* Effect.promise(() =>
        t.run(async (ctx) => ({
          release: await ctx.db
            .query("contentReleases")
            .withIndex("by_releaseId", (index) =>
              index.eq("releaseId", CANDIDATE.releaseId)
            )
            .unique(),
          state: await ctx.db.query("contentState").unique(),
        }))
      );
      expect(unchanged.release?.status).toBe("verified");
      expect(unchanged.state).toMatchObject({
        candidateReleaseId: CANDIDATE.releaseId,
      });
      expect(unchanged.state?.activeReleaseId).toBeUndefined();
    })
  );

  it.effect("requires a pair for a newly inherited runtime", () =>
    Effect.gen(function* () {
      const t = convexTest(schema, convexModules);
      const fixture = yield* makeActivationRuntime();
      const snapshots = {
        ...inheritContentSnapshots(null),
        tryout: inheritContentSnapshot(fixture.snapshot.snapshotId),
      };
      yield* Effect.promise(() =>
        t.mutation((ctx) =>
          seedVerifiedPair(ctx, {
            base: BASE,
            candidate: snapshots,
            recovery: snapshots,
          })
        )
      );

      yield* Effect.promise(() =>
        expect(activateCandidate(t)).rejects.toMatchObject({
          data: { code: "CONTENT_RELEASE_INTEGRITY" },
        })
      );
      const state = yield* Effect.promise(() =>
        t.run((ctx) => ctx.db.query("contentState").unique())
      );
      expect(state).toMatchObject({
        activeReleaseId: BASE.releaseId,
        candidateReleaseId: CANDIDATE.releaseId,
      });
    })
  );

  it.effect("requires the distinct retained base before the state flip", () =>
    Effect.gen(function* () {
      const t = convexTest(schema, convexModules);
      const result = yield* makeActivationRuntime({ hasBaseSnapshot: true });
      const retainedBase = yield* makeActivationRuntime({
        bundleSnapshot: "base",
        hasBaseSnapshot: true,
      });
      const snapshots = result.release.manifest.snapshots;
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

      yield* Effect.promise(() =>
        expect(activateCandidate(t)).rejects.toMatchObject({
          data: { code: "CONTENT_RELEASE_INTEGRITY" },
        })
      );
      const before = yield* Effect.promise(() =>
        t.run((ctx) => ctx.db.query("contentState").unique())
      );
      expect(before).toMatchObject({
        activeReleaseId: BASE.releaseId,
        candidateReleaseId: CANDIDATE.releaseId,
      });

      yield* storeRuntimeFixture(t, retainedBase);
      const activation = yield* Effect.promise(() => activateCandidate(t));
      const publication = yield* Effect.promise(() => t.query(current, {}));
      expect(activation.kind).toBe("activated");
      expect(
        JSON.parse(publication.tryoutRuntimeBundleJson ?? "{}")
      ).toMatchObject({ bundleHash: result.bundle.bundleHash });

      yield* Effect.promise(() =>
        t.mutation(async (ctx) => {
          const stored = await ctx.db
            .query("tryoutRuntimeBundles")
            .withIndex("by_bundleHash", (index) =>
              index.eq("bundleHash", retainedBase.bundle.bundleHash)
            )
            .unique();
          expect(stored).not.toBeNull();
          if (stored) {
            await ctx.db.delete("tryoutRuntimeBundles", stored._id);
          }
        })
      );
      yield* Effect.promise(() =>
        expect(t.query(current, {})).rejects.toMatchObject({
          data: { code: "CONTENT_RELEASE_INTEGRITY" },
        })
      );
      yield* Effect.promise(() =>
        expect(activateCandidate(t)).rejects.toMatchObject({
          data: { code: "CONTENT_RELEASE_INTEGRITY" },
        })
      );
      const retained = yield* Effect.promise(() =>
        t.run((ctx) => ctx.db.query("contentState").unique())
      );
      expect(retained).toMatchObject({
        activeReleaseId: CANDIDATE.releaseId,
        recoveryReleaseId: "release-recovery",
      });
    })
  );

  it.effect(
    "returns completed proof without duplicating permanent storage",
    () =>
      Effect.gen(function* () {
        const t = convexTest(schema, convexModules);
        const fixture = yield* makeActivationRuntime();
        const snapshots = fixture.release.manifest.snapshots;
        yield* Effect.promise(() =>
          t.mutation((ctx) =>
            seedVerifiedPair(ctx, {
              candidate: snapshots,
              recovery: invertContentSnapshots(snapshots),
            })
          )
        );
        yield* storeRuntimeFixture(t, fixture);
        yield* Effect.promise(() => activateCandidate(t));

        const retry = yield* Effect.promise(() => activateCandidate(t));
        const runtime = yield* Effect.promise(() =>
          t.run((ctx) => ctx.db.query("tryoutRuntimeBundles").collect())
        );
        expect(retry.kind).toBe("completed");
        expect(runtime).toHaveLength(1);
      })
  );

  it.effect("fails closed on completed retry and current state drift", () =>
    Effect.gen(function* () {
      const t = convexTest(schema, convexModules);
      const fixture = yield* makeActivationRuntime();
      const snapshots = fixture.release.manifest.snapshots;
      yield* Effect.promise(() =>
        t.mutation((ctx) =>
          seedVerifiedPair(ctx, {
            candidate: snapshots,
            recovery: invertContentSnapshots(snapshots),
          })
        )
      );
      yield* storeRuntimeFixture(t, fixture);
      yield* Effect.promise(() => activateCandidate(t));
      yield* Effect.promise(() =>
        t.mutation(async (ctx) => {
          const permanent = await ctx.db
            .query("tryoutRuntimeBundles")
            .withIndex("by_bundleHash", (index) =>
              index.eq("bundleHash", fixture.bundle.bundleHash)
            )
            .unique();
          expect(permanent).not.toBeNull();
          if (permanent) {
            await ctx.db.delete("tryoutRuntimeBundles", permanent._id);
          }
        })
      );

      yield* Effect.promise(() =>
        expect(activateCandidate(t)).rejects.toMatchObject({
          data: { code: "CONTENT_RELEASE_INTEGRITY" },
        })
      );
      yield* Effect.promise(() =>
        expect(t.query(current, {})).rejects.toMatchObject({
          data: { code: "CONTENT_RELEASE_INTEGRITY" },
        })
      );
      const state = yield* Effect.promise(() =>
        t.run((ctx) => ctx.db.query("contentState").unique())
      );
      expect(state?.activeReleaseId).toBe(CANDIDATE.releaseId);
    })
  );
});

describe("contentRelease/tryout runtime retention", () => {
  it.each([
    {
      expected: RETENTION_RELEASE_ID,
      name: "result snapshot match",
      seed: { originKind: "git", snapshotId: RETENTION_RESULT_SNAPSHOT },
    },
    {
      expected: RETENTION_RELEASE_ID,
      name: "git base snapshot match",
      seed: {
        baseSnapshotId: RETENTION_BASE_SNAPSHOT,
        originKind: "git",
        snapshotId: RETENTION_BASE_SNAPSHOT,
      },
    },
    {
      expected: null,
      name: "newer pair selected",
      seed: {
        baseSnapshotId: RETENTION_BASE_SNAPSHOT,
        originKind: "git",
        resultSnapshotId: RETENTION_NEWER_SNAPSHOT,
        snapshotId: RETENTION_OTHER_SNAPSHOT,
      },
    },
    {
      expected: null,
      name: "rollback restore never retains its base",
      seed: {
        baseSnapshotId: RETENTION_BASE_SNAPSHOT,
        originKind: "rollback",
        snapshotId: RETENTION_BASE_SNAPSHOT,
      },
    },
    {
      expected: null,
      name: "renderer manifest drift",
      seed: {
        originKind: "git",
        rendererManifestHash: `sha256:${"2".repeat(64)}`,
        snapshotId: RETENTION_RESULT_SNAPSHOT,
      },
    },
    {
      expected: null,
      name: "no publication state",
      seed: {
        originKind: "git",
        snapshotId: RETENTION_RESULT_SNAPSHOT,
        withState: false,
      },
    },
  ] as const)("$name", async ({ seed, expected }) => {
    const t = convexTest(schema, convexModules);
    const rowId = await t.mutation((ctx) => seedRuntimeRetentionRow(ctx, seed));
    const retention = await readRuntimeRetention(t, rowId);
    expect(retention.retainingReleaseId).toBe(expected);
  });

  it.effect("rejects reconciliation of a missing permanent pair", () =>
    Effect.gen(function* () {
      const t = convexTest(schema, convexModules);
      const rowId = yield* Effect.promise(() =>
        t.mutation(async (ctx) => {
          const stored = await seedRuntimeRetentionRow(ctx, {
            originKind: "git",
            snapshotId: RETENTION_RESULT_SNAPSHOT,
            withState: false,
          });
          await ctx.db.delete("tryoutRuntimeBundles", stored);
          return stored;
        })
      );
      yield* Effect.promise(() =>
        expect(
          t.mutation((ctx) =>
            runConvexProgram(reconcileTryoutRuntimeAfterAttempt(ctx, rowId))
          )
        ).rejects.toMatchObject({
          data: { code: "CONTENT_RELEASE_INTEGRITY" },
        })
      );
    })
  );

  it.each([
    {
      cleanupReleaseId: RETENTION_RELEASE_ID,
      expectedOwner: RETENTION_RELEASE_ID,
      name: "keeps an already owned pair",
      withState: true,
    },
    {
      cleanupReleaseId: "release-retention-old",
      expectedOwner: RETENTION_RELEASE_ID,
      name: "transfers the active cleanup owner",
      withState: true,
    },
    {
      cleanupReleaseId: "release-retention-old",
      deleted: true,
      name: "deletes an unreferenced pair with a retired owner",
      withState: false,
    },
    {
      expectedOwner: undefined,
      name: "keeps an unreferenced pair without an owner",
      withState: false,
    },
    {
      attempt: true,
      cleanupReleaseId: "release-retention-old",
      expectedOwner: "release-retention-old",
      name: "keeps a pair with an active attempt",
      withState: false,
    },
  ] as const)(
    "$name",
    async ({
      attempt,
      cleanupReleaseId,
      deleted,
      expectedOwner,
      withState,
    }) => {
      const t = convexTest(schema, convexModules);
      const rowId = await t.mutation(async (ctx) => {
        const stored = await seedRuntimeRetentionRow(ctx, {
          cleanupReleaseId,
          originKind: "git",
          snapshotId: RETENTION_RESULT_SNAPSHOT,
          withState,
        });
        if (attempt) {
          await insertRetentionAttempt(ctx, stored);
        }
        return stored;
      });
      await t.mutation((ctx) =>
        runConvexProgram(reconcileTryoutRuntimeAfterAttempt(ctx, rowId))
      );
      const stored = await t.run((ctx) =>
        ctx.db.get("tryoutRuntimeBundles", rowId)
      );
      if (deleted) {
        expect(stored).toBeNull();
        return;
      }
      expect(stored?.cleanupReleaseId).toBe(expectedOwner);
    }
  );
});
