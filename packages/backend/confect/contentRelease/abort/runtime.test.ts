import { assert, describe, expect, it } from "@effect/vitest";
import { ReleaseIdSchema } from "@nakafa/aksara-contracts/ids";
import { abortProgram } from "@repo/backend/confect/contentRelease/abort";
import { releaseReachability } from "@repo/backend/confect/contentRelease/reachability";
import { reconcileTryoutRuntimeAfterAttempt } from "@repo/backend/confect/contentRelease/tryout/runtime";
import { runConvexProgram } from "@repo/backend/confect/runtime";
import { convexModules } from "@repo/backend/confect/test.setup";
import { internal } from "@repo/backend/convex/_generated/api";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import schema from "@repo/backend/convex/schema";
import { storeRuntimeFixture } from "@repo/backend/test/runtime/bundle";
import {
  insertRuntimeIngressSource,
  makeRuntimeIngressFixture,
} from "@repo/backend/test/runtime/ingress";
import { insertRetentionAttempt } from "@repo/backend/test/runtime/retention";
import { convexTest } from "convex-test";
import { Effect } from "effect";

/** Runs one release abort through the native Convex test boundary. */
function abort(ctx: MutationCtx, releaseId: string) {
  return runConvexProgram(abortProgram(ctx, releaseId));
}

describe("content release abort runtime", () => {
  it.effect(
    "retains an aborted runtime until its last learner attempt is removed",
    () =>
      Effect.gen(function* () {
        const t = convexTest(schema, convexModules);
        const fixture = yield* makeRuntimeIngressFixture();
        const releaseId = fixture.release.manifest.releaseId;
        yield* insertRuntimeIngressSource(t, fixture);
        yield* storeRuntimeFixture(t, fixture);
        const runtimeId = yield* Effect.promise(() =>
          t.mutation(async (ctx) => {
            const runtime = await ctx.db.query("tryoutRuntimeBundles").unique();
            assert(runtime);
            await insertRetentionAttempt(ctx, runtime._id);
            return runtime._id;
          })
        );
        for (let retry = 0; retry < 2; retry += 1) {
          expect(
            yield* Effect.promise(() =>
              t.mutation((ctx) => abort(ctx, releaseId))
            )
          ).toMatchObject({ complete: true });
        }
        const retained = yield* Effect.promise(() =>
          t.query(async (ctx) => ({
            release: await ctx.db.query("contentReleases").unique(),
            runtime: await ctx.db.get(runtimeId),
            attempts: await ctx.db.query("tryoutAttempts").collect(),
          }))
        );
        expect(retained.release?.status).toBe("aborted");
        expect(retained.runtime).toMatchObject({ cleanupReleaseId: releaseId });
        expect(retained.attempts).toHaveLength(1);
        yield* Effect.promise(() =>
          t.mutation(async (ctx) => {
            const attempt = await ctx.db.query("tryoutAttempts").unique();
            assert(attempt);
            await ctx.db.delete(attempt._id);
          })
        );
        yield* Effect.promise(() =>
          expect(
            t.mutation(internal.contentRelease.manifest.abort, { releaseId })
          ).rejects.toMatchObject({
            data: { code: "CONTENT_RELEASE_INTEGRITY" },
          })
        );
        yield* Effect.promise(() =>
          t.mutation((ctx) =>
            runConvexProgram(reconcileTryoutRuntimeAfterAttempt(ctx, runtimeId))
          )
        );
        expect(
          yield* Effect.promise(() => t.query((ctx) => ctx.db.get(runtimeId)))
        ).toBeNull();
      })
  );

  it.effect("removes source-owned rows staged before a snapshot root", () =>
    Effect.gen(function* () {
      const t = convexTest(schema, convexModules);
      const fixture = yield* makeRuntimeIngressFixture();
      const releaseId = fixture.release.manifest.releaseId;
      yield* insertRuntimeIngressSource(t, fixture);
      yield* storeRuntimeFixture(t, fixture);

      const receipt = yield* Effect.promise(() =>
        t.mutation((ctx) => abort(ctx, releaseId))
      );
      const stored = yield* Effect.promise(() =>
        t.run(async (ctx) => ({
          release: await ctx.db.query("contentReleases").unique(),
          runtime: await ctx.db.query("tryoutRuntimeBundles").collect(),
        }))
      );

      expect(receipt).toMatchObject({ complete: true, processedItems: 0 });
      expect(stored.release?.status).toBe("aborted");
      expect(stored.runtime).toEqual([]);
    })
  );

  it.effect("preserves a pair reused from another source release", () =>
    Effect.gen(function* () {
      const t = convexTest(schema, convexModules);
      const original = yield* makeRuntimeIngressFixture(
        ReleaseIdSchema.make("release-runtime-original")
      );
      const current = yield* makeRuntimeIngressFixture(
        ReleaseIdSchema.make("release-runtime-current")
      );
      yield* storeRuntimeFixture(t, original);
      yield* insertRuntimeIngressSource(t, current);
      const reused = yield* storeRuntimeFixture(t, current);

      yield* Effect.promise(() =>
        t.mutation((ctx) => abort(ctx, current.release.manifest.releaseId))
      );
      const stored = yield* Effect.promise(() =>
        t.run((ctx) => ctx.db.query("tryoutRuntimeBundles").collect())
      );

      expect(reused).toMatchObject({ created: 0, unchanged: 1 });
      expect(stored).toEqual([
        expect.objectContaining({
          cleanupReleaseId: original.release.manifest.releaseId,
          sourceReleaseId: original.release.manifest.releaseId,
        }),
      ]);
    })
  );

  it.effect("preserves a source-owned pair reused by the active release", () =>
    Effect.gen(function* () {
      const t = convexTest(schema, convexModules);
      const recovery = yield* makeRuntimeIngressFixture(
        ReleaseIdSchema.make("release-runtime-recovery")
      );
      const active = yield* makeRuntimeIngressFixture(
        ReleaseIdSchema.make("release-runtime-active")
      );
      yield* insertRuntimeIngressSource(t, recovery);
      yield* storeRuntimeFixture(t, recovery);
      const reused = yield* storeRuntimeFixture(t, active);
      yield* Effect.promise(() =>
        t.mutation(async (ctx) => {
          const recoveryRelease = await ctx.db
            .query("contentReleases")
            .withIndex("by_releaseId", (query) =>
              query.eq("releaseId", recovery.release.manifest.releaseId)
            )
            .unique();
          const state = await ctx.db.query("contentState").unique();
          const runtime = await ctx.db.query("tryoutRuntimeBundles").unique();
          if (!(recoveryRelease && state && runtime)) {
            throw new Error("Expected recovery runtime fixtures.");
          }
          const { _creationTime, _id, ...releaseFields } = recoveryRelease;
          await ctx.db.patch("contentReleases", _id, { role: "recovery" });
          await ctx.db.insert("contentReleases", {
            ...releaseFields,
            ...releaseReachability(active.release),
            completedAt: 1,
            releaseId: active.release.manifest.releaseId,
            releaseJson: JSON.stringify(active.release),
            role: "candidate",
            sequence: 2,
            status: "completed",
            tryoutRuntimeBundleHash: runtime.bundleHash,
          });
          await ctx.db.patch("contentState", state._id, {
            activeManifestHash: active.release.manifestHash,
            activeReleaseId: active.release.manifest.releaseId,
            activeSequence: 2,
            candidateManifestHash: undefined,
            candidateReleaseId: undefined,
            candidateSequence: undefined,
            nextSequence: 3,
            recoveryManifestHash: recovery.release.manifestHash,
            recoveryReleaseId: recovery.release.manifest.releaseId,
            recoverySequence: 1,
          });
        })
      );

      const receipt = yield* Effect.promise(() =>
        t.mutation((ctx) => abort(ctx, recovery.release.manifest.releaseId))
      );
      const stored = yield* Effect.promise(() =>
        t.run(async (ctx) => ({
          active: await ctx.db
            .query("contentReleases")
            .withIndex("by_releaseId", (query) =>
              query.eq("releaseId", active.release.manifest.releaseId)
            )
            .unique(),
          runtime: await ctx.db.query("tryoutRuntimeBundles").collect(),
          state: await ctx.db.query("contentState").unique(),
        }))
      );

      expect(reused).toMatchObject({ created: 0, unchanged: 1 });
      expect(receipt).toMatchObject({ complete: true, processedItems: 0 });
      expect(stored.active?.status).toBe("completed");
      expect(stored.state?.activeReleaseId).toBe(
        active.release.manifest.releaseId
      );
      expect(stored.runtime).toEqual([
        expect.objectContaining({
          cleanupReleaseId: active.release.manifest.releaseId,
          sourceReleaseId: recovery.release.manifest.releaseId,
        }),
      ]);
    })
  );

  it.effect("removes a reused pair after both invisible slots abort", () =>
    Effect.gen(function* () {
      const t = convexTest(schema, convexModules);
      const recovery = yield* makeRuntimeIngressFixture(
        ReleaseIdSchema.make("release-runtime-recovery")
      );
      const candidate = yield* makeRuntimeIngressFixture(
        ReleaseIdSchema.make("release-runtime-candidate")
      );
      yield* insertRuntimeIngressSource(t, recovery);
      yield* storeRuntimeFixture(t, recovery);
      const reused = yield* storeRuntimeFixture(t, candidate);
      yield* Effect.promise(() =>
        t.mutation(async (ctx) => {
          const recoveryRelease = await ctx.db
            .query("contentReleases")
            .withIndex("by_releaseId", (query) =>
              query.eq("releaseId", recovery.release.manifest.releaseId)
            )
            .unique();
          const state = await ctx.db.query("contentState").unique();
          const runtime = await ctx.db.query("tryoutRuntimeBundles").unique();
          if (!(recoveryRelease && state && runtime)) {
            throw new Error("Expected invisible-slot runtime fixtures.");
          }
          const { _creationTime, _id, ...releaseFields } = recoveryRelease;
          await ctx.db.patch("contentReleases", _id, { role: "recovery" });
          await ctx.db.insert("contentReleases", {
            ...releaseFields,
            ...releaseReachability(candidate.release),
            releaseId: candidate.release.manifest.releaseId,
            releaseJson: JSON.stringify(candidate.release),
            role: "candidate",
            sequence: 2,
          });
          await ctx.db.patch("contentState", state._id, {
            candidateManifestHash: candidate.release.manifestHash,
            candidateReleaseId: candidate.release.manifest.releaseId,
            candidateSequence: 2,
            nextSequence: 3,
            recoveryManifestHash: recovery.release.manifestHash,
            recoveryReleaseId: recovery.release.manifest.releaseId,
            recoverySequence: 1,
          });
        })
      );

      const recoveryReceipt = yield* Effect.promise(() =>
        t.mutation((ctx) => abort(ctx, recovery.release.manifest.releaseId))
      );
      const transferred = yield* Effect.promise(() =>
        t.run((ctx) => ctx.db.query("tryoutRuntimeBundles").unique())
      );
      const candidateReceipt = yield* Effect.promise(() =>
        t.mutation((ctx) => abort(ctx, candidate.release.manifest.releaseId))
      );
      const repeatedRecovery = yield* Effect.promise(() =>
        t.mutation((ctx) => abort(ctx, recovery.release.manifest.releaseId))
      );
      const stored = yield* Effect.promise(() =>
        t.run(async (ctx) => ({
          releases: await ctx.db.query("contentReleases").collect(),
          runtime: await ctx.db.query("tryoutRuntimeBundles").collect(),
          state: await ctx.db.query("contentState").unique(),
        }))
      );

      expect(reused).toMatchObject({ created: 0, unchanged: 1 });
      expect(recoveryReceipt).toMatchObject({ complete: true });
      expect(transferred).toMatchObject({
        cleanupReleaseId: candidate.release.manifest.releaseId,
        sourceReleaseId: recovery.release.manifest.releaseId,
      });
      expect(candidateReceipt).toMatchObject({ complete: true });
      expect(repeatedRecovery).toMatchObject({ complete: true });
      expect(stored.releases.map(({ status }) => status)).toEqual([
        "aborted",
        "aborted",
      ]);
      expect(stored.runtime).toEqual([]);
      expect(stored.state).not.toHaveProperty("candidateReleaseId");
      expect(stored.state).not.toHaveProperty("recoveryReleaseId");
    })
  );

  it.effect("fails closed above the signed transition pair bound", () =>
    Effect.gen(function* () {
      const t = convexTest(schema, convexModules);
      const fixture = yield* makeRuntimeIngressFixture();
      const releaseId = fixture.release.manifest.releaseId;
      yield* insertRuntimeIngressSource(t, fixture);
      yield* Effect.promise(() =>
        t.mutation(async (ctx) => {
          for (let index = 0; index < 3; index += 1) {
            await ctx.db.insert("tryoutRuntimeBundles", {
              bundleHash: `sha256:${index.toString().repeat(64)}`,
              bundleJson: "{}",
              cleanupReleaseId: releaseId,
              createdAt: index,
              rendererJson: "{}",
              rendererManifestHash: `sha256:${"a".repeat(64)}`,
              snapshotId: `sha256:${index.toString().repeat(64)}`,
              sourceGitSha: "a".repeat(40),
              sourceManifestHash: `sha256:${"b".repeat(64)}`,
              sourceReleaseId: releaseId,
            });
          }
        })
      );

      yield* Effect.promise(() =>
        expect(
          t.mutation((ctx) => abort(ctx, releaseId))
        ).rejects.toMatchObject({
          data: { code: "CONTENT_RELEASE_INTEGRITY" },
        })
      );
      const stored = yield* Effect.promise(() =>
        t.run(async (ctx) => ({
          release: await ctx.db.query("contentReleases").unique(),
          runtime: await ctx.db.query("tryoutRuntimeBundles").collect(),
        }))
      );
      expect(stored.release?.status).toBe("staging");
      expect(stored.runtime).toHaveLength(3);
    })
  );
});
