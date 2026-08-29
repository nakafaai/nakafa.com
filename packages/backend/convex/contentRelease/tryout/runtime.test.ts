import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "@effect/vitest";
import {
  inheritContentSnapshot,
  inheritContentSnapshots,
  invertContentSnapshots,
} from "@nakafa/aksara-contracts/release/snapshot/spec";
import { internal } from "@repo/backend/convex/_generated/api";
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
import { convexTest } from "convex-test";
import { Effect } from "effect";

const activate = internal.contentRelease.activate.activate;
const current = internal.contentRelease.status.current;

/** Runs the exact candidate activation request used by every runtime gate. */
function activateCandidate(t: ReturnType<typeof convexTest>) {
  return t.mutation(activate, {
    manifestHash: CANDIDATE.manifestHash,
    releaseId: CANDIDATE.releaseId,
    rendererJson: testRendererJson(),
  });
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

  it.effect("returns completed proof without duplicating permanent storage", () =>
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
