import { RegisteredConvexFunction } from "@confect/server";
import { assert, describe, expect, it } from "@effect/vitest";
import { ContentFamilySchema } from "@nakafa/aksara-contracts/content";
import confectSchema from "@repo/backend/confect/_generated/schema";
import { abortProgram } from "@repo/backend/confect/contentRelease/abort";
import { ROLLBACK_RETENTION_MS } from "@repo/backend/confect/contentRelease/spec";
import { convexModules } from "@repo/backend/confect/test.setup";
import { internal } from "@repo/backend/convex/_generated/api";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import schema from "@repo/backend/convex/schema";
import {
  ABORT_BATCH_HASH,
  ABORT_ITEM_COUNT,
  ABORT_RELEASE_ID,
  abortContentKey,
  seedAbortRelease,
} from "@repo/backend/test/content/abort";
import { insertTestArtifact } from "@repo/backend/test/content/artifact";
import { testProjectionJson } from "@repo/backend/test/content/material";
import { TEST_DIGEST, testTextHash } from "@repo/backend/test/content/release";
import {
  insertZeroRelease,
  type TestIdentity,
} from "@repo/backend/test/content/state";
import { convexTest } from "convex-test";
import { DateTime, Effect } from "effect";

/** Runs one server-cursor abort page at the native Convex test boundary. */
function abort(ctx: MutationCtx, releaseId = ABORT_RELEASE_ID) {
  return abortProgram(releaseId).pipe(
    Effect.provide(RegisteredConvexFunction.mutationLayer(confectSchema, ctx))
  );
}
describe("contentRelease/abort", () => {
  it.each(["missing", "excess"])(
    "rejects %s abort rows without committing partial deletion",
    async (drift) => {
      const t = convexTest(schema, convexModules);
      await t.mutation(async (ctx) => {
        await seedAbortRelease(ctx);
        const release = await ctx.db.query("contentReleases").unique();
        assert(release);
        if (drift === "missing") {
          for (const row of await ctx.db
            .query("contentItems")
            .take(ABORT_ITEM_COUNT)) {
            await ctx.db.delete(row._id);
          }
        } else {
          await ctx.db.patch(release._id, {
            stagedItems: ABORT_ITEM_COUNT - 1,
          });
        }
      });
      const read = () =>
        t.query(async (ctx) => ({
          items: await ctx.db.query("contentItems").take(ABORT_ITEM_COUNT),
          keys: await ctx.db.query("contentKeys").take(ABORT_ITEM_COUNT),
          release: await ctx.db.query("contentReleases").unique(),
          state: await ctx.db.query("contentState").unique(),
        }));
      const before = await read();
      await expect(
        t.mutation(internal.contentRelease.manifest.abort, {
          releaseId: ABORT_RELEASE_ID,
        })
      ).rejects.toMatchObject({
        data: {
          code: "CONTENT_RELEASE_INTEGRITY",
        },
      });
      expect(await read()).toEqual(before);
    }
  );
  it("resumes durable deletion and accepts terminal response-loss retries", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(seedAbortRelease);
    const completed = await t.mutation((ctx) => Effect.runPromise(abort(ctx)));
    const repeated = await t.mutation((ctx) => Effect.runPromise(abort(ctx)));
    const stored = await t.run(async (ctx) => ({
      items: await ctx.db.query("contentItems").collect(),
      keys: await ctx.db.query("contentKeys").collect(),
      release: await ctx.db.query("contentReleases").unique(),
      state: await ctx.db.query("contentState").unique(),
    }));
    expect(completed).toEqual({
      complete: true,
      processedItems: ABORT_ITEM_COUNT,
      releaseId: ABORT_RELEASE_ID,
      totalItems: ABORT_ITEM_COUNT,
    });
    expect(repeated).toEqual(completed);
    expect(stored.items).toHaveLength(0);
    expect(stored.keys).toHaveLength(0);
    expect(stored.release?.status).toBe("aborted");
    expect(stored.state?.candidateReleaseId).toBeUndefined();
    const release = stored.release;
    assert(release);
    await t.mutation((ctx) =>
      ctx.db.patch(release._id, {
        abortedRows: ABORT_ITEM_COUNT + 1,
      })
    );
    await expect(
      t.mutation(internal.contentRelease.manifest.abort, {
        releaseId: ABORT_RELEASE_ID,
      })
    ).rejects.toMatchObject({
      data: {
        code: "CONTENT_RELEASE_INTEGRITY",
      },
    });
  });
  it("preserves staged rows when the release no longer owns its slot", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(seedAbortRelease);
    await t.mutation(async (ctx) => {
      const state = await ctx.db.query("contentState").unique();
      assert(state);
      await ctx.db.patch(state._id, {
        candidateReleaseId: "release-another-owner",
      });
    });
    await expect(
      t.mutation(internal.contentRelease.manifest.abort, {
        releaseId: ABORT_RELEASE_ID,
      })
    ).rejects.toMatchObject({
      data: {
        code: "CONTENT_RELEASE_STATE",
      },
    });
    expect(
      await t.query((ctx) => ctx.db.query("contentItems").collect())
    ).toHaveLength(ABORT_ITEM_COUNT);
  });
  it("resumes one byte-bounded large-row cleanup", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(seedAbortRelease);
    await t.mutation(async (ctx) => {
      const items = await ctx.db
        .query("contentItems")
        .withIndex("by_releaseId_and_index", (query) =>
          query.eq("releaseId", ABORT_RELEASE_ID)
        )
        .take(ABORT_ITEM_COUNT / 2);
      for (const item of items) {
        await ctx.db.patch("contentItems", item._id, {
          itemJson: "x".repeat(384 * 1024),
        });
      }
    });
    const first = await t.mutation((ctx) => Effect.runPromise(abort(ctx)));
    let completed = first;
    while (!completed.complete) {
      completed = await t.mutation((ctx) => Effect.runPromise(abort(ctx)));
    }
    expect(first.complete).toBe(false);
    expect(first.processedItems).toBeGreaterThan(0);
    expect(first.processedItems).toBeLessThan(ABORT_ITEM_COUNT);
    expect(completed).toMatchObject({
      complete: true,
      processedItems: ABORT_ITEM_COUNT,
    });
  });
  it("removes staged path ownership before a later sequence can claim it", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      await seedAbortRelease(ctx);
      await ctx.db.insert("contentPaths", {
        createdSequence: 1,
        appLocale: "en",
        publicPath: "test/abandoned",
      });
      await ctx.db.insert("contentBindings", {
        batchHash: ABORT_BATCH_HASH,
        batchIndex: 0,
        contentKey: abortContentKey(0),
        index: 0,
        appLocale: "en",
        operation: "bind",
        publicPath: "test/abandoned",
        releaseId: ABORT_RELEASE_ID,
        routeJson: "{}",
        sequence: 1,
      });
      const release = await ctx.db.query("contentReleases").unique();
      if (!release) {
        throw new Error("Expected staged abort release.");
      }
      await ctx.db.patch("contentReleases", release._id, {
        stagedRoutes: 1,
      });
    });
    let receipt = await t.mutation((ctx) => Effect.runPromise(abort(ctx)));
    while (!receipt.complete) {
      receipt = await t.mutation((ctx) => Effect.runPromise(abort(ctx)));
    }
    const paths = await t.run((ctx) => ctx.db.query("contentPaths").take(1));
    expect(paths).toEqual([]);
  });
  it("requires recovery abort before candidate abort", async () => {
    const t = convexTest(schema, convexModules);
    const candidate = {
      manifestHash: `sha256:${"1".repeat(64)}`,
      releaseId: ABORT_RELEASE_ID,
      sequence: 1,
    } satisfies TestIdentity;
    const recovery = {
      manifestHash: `sha256:${"b".repeat(64)}`,
      releaseId: "release-abort-recovery",
      sequence: 2,
    } satisfies TestIdentity;
    await t.mutation(seedAbortRelease);
    await t.mutation(async (ctx) => {
      await insertZeroRelease(ctx, {
        ...recovery,
        base: candidate,
        originReleaseId: candidate.releaseId,
        ownership: {
          base: ContentFamilySchema.literals,
          result: [],
        },
        role: "recovery",
        status: "verified",
      });
      const state = await ctx.db.query("contentState").unique();
      if (!state) {
        throw new Error("Expected content state.");
      }
      await ctx.db.patch("contentState", state._id, {
        nextSequence: 3,
        recoveryManifestHash: recovery.manifestHash,
        recoveryReleaseId: recovery.releaseId,
        recoverySequence: recovery.sequence,
      });
    });
    await expect(
      t.mutation((ctx) => Effect.runPromise(abort(ctx)))
    ).rejects.toMatchObject({
      code: "CONTENT_RELEASE_STATE",
    });
    await expect(
      t.mutation((ctx) => Effect.runPromise(abort(ctx, recovery.releaseId)))
    ).resolves.toMatchObject({
      complete: true,
    });
    await expect(
      t.mutation((ctx) => Effect.runPromise(abort(ctx)))
    ).resolves.toMatchObject({
      complete: true,
    });
  });
  it.each([false, true])(
    "starts artifact retention only after the final reference, shared: %s",
    async (shared) => {
      const t = convexTest(schema, convexModules);
      const artifactHash = `sha256:${"d".repeat(64)}`;
      await t.mutation(async (ctx) => {
        await seedAbortRelease(ctx);
        const item = await ctx.db
          .query("contentItems")
          .withIndex("by_releaseId_and_index", (query) =>
            query.eq("releaseId", ABORT_RELEASE_ID).eq("index", 0)
          )
          .unique();
        if (!item) {
          throw new Error("Expected staged abort item.");
        }
        await ctx.db.patch("contentItems", item._id, {
          artifactHash,
          artifactReady: true,
        });
        await insertTestArtifact(ctx, {
          artifactHash,
          artifactJson: "{}",
          retainUntil: 0,
        });
        if (shared) {
          const previousReleaseId = "release-retained-artifact";
          await insertZeroRelease(ctx, {
            manifestHash: TEST_DIGEST,
            releaseId: previousReleaseId,
            sequence: 0,
            role: "candidate",
            status: "completed",
            ownership: {
              base: [],
              result: ContentFamilySchema.literals,
            },
          });
          await ctx.db.insert("contentHeads", {
            artifactHash,
            artifactLocale: "en",
            compilerConfigHash: TEST_DIGEST,
            contentKey: "test:retained-artifact",
            delivery: "public",
            family: "material",
            index: 0,
            operation: "upsert",
            releaseId: previousReleaseId,
            rendererDomain: "mathematics",
            sequence: 0,
            sourceHash: TEST_DIGEST,
            sourcePath: "packages/corpus/test/retained/en.mdx",
          });
        }
      });
      const startedAt = DateTime.toEpochMillis(DateTime.nowUnsafe());
      await t.mutation((ctx) => Effect.runPromise(abort(ctx)));
      const facts = await t.run((ctx) =>
        ctx.db.query("contentArtifactFacts").unique()
      );
      if (shared) {
        expect(facts?.retainUntil).toBe(0);
      } else {
        expect(facts?.retainUntil).toBeGreaterThanOrEqual(
          startedAt + ROLLBACK_RETENTION_MS
        );
      }
    }
  );
  it("preserves the active search entry while discarding a checked head", async () => {
    const t = convexTest(schema, convexModules);
    const contentKey = abortContentKey(0);
    const projectionJson = testProjectionJson({
      contentKey,
      publicPath: "subjects/test/abort-0",
    });
    const projectionHash = testTextHash(projectionJson);
    await t.mutation(async (ctx) => {
      await seedAbortRelease(ctx);
      const release = await ctx.db.query("contentReleases").unique();
      if (!release) {
        throw new Error("Expected abort release.");
      }
      await ctx.db.patch("contentReleases", release._id, {
        checkedItems: 1,
      });
      await ctx.db.insert("contentHeads", {
        artifactHash: `sha256:${"d".repeat(64)}`,
        compilerConfigHash: TEST_DIGEST,
        contentKey,
        delivery: "public",
        family: "material",
        index: 0,
        artifactLocale: "en",
        operation: "upsert",
        projectionHash,
        projectionJson,
        releaseId: ABORT_RELEASE_ID,
        rendererDomain: "mathematics",
        sequence: 1,
        sourceHash: TEST_DIGEST,
        sourcePath: "packages/corpus/test/abort-0/en.mdx",
      });
      await ctx.db.insert("contentIndex", {
        contentKey,
        family: "material",
        appLocale: "en",
        projectionHash,
        publicPath: "test/abort-0",
        releaseId: "release-before-abort",
        sequence: 0,
        slot: "blue",
        text: "active search entry",
      });
    });
    await t.mutation((ctx) => Effect.runPromise(abort(ctx)));
    await t.mutation((ctx) => Effect.runPromise(abort(ctx)));
    const stored = await t.run(async (ctx) => ({
      heads: await ctx.db.query("contentHeads").take(1),
      search: await ctx.db.query("contentIndex").take(1),
    }));
    expect(stored.heads).toEqual([]);
    expect(stored.search).toMatchObject([
      {
        contentKey,
        releaseId: "release-before-abort",
      },
    ]);
  });
  it("rejects an active release and corrupted abort progress", async () => {
    const active = convexTest(schema, convexModules);
    const identity = {
      manifestHash: `sha256:${"c".repeat(64)}`,
      releaseId: "release-active",
      sequence: 1,
    } satisfies TestIdentity;
    await active.mutation(async (ctx) => {
      await insertZeroRelease(ctx, {
        ...identity,
        ownership: {
          base: [],
          result: ContentFamilySchema.literals,
        },
        role: "candidate",
        status: "completed",
      });
    });
    await expect(
      active.mutation((ctx) =>
        Effect.runPromise(abort(ctx, identity.releaseId))
      )
    ).rejects.toMatchObject({
      code: "CONTENT_RELEASE_STATE",
    });
    for (const abortedRows of [ABORT_ITEM_COUNT, undefined]) {
      const corrupt = convexTest(schema, convexModules);
      await corrupt.mutation(seedAbortRelease);
      await corrupt.mutation(async (ctx) => {
        const release = await ctx.db.query("contentReleases").unique();
        assert(release);
        await ctx.db.patch("contentReleases", release._id, {
          abortedRows,
          abortingAt: Date.UTC(2026, 6, 23, 12),
          status: "aborting",
        });
      });
      const read = () =>
        corrupt.query(async (ctx) => ({
          items: await ctx.db.query("contentItems").collect(),
          release: await ctx.db.query("contentReleases").unique(),
        }));
      const before = await read();
      await expect(
        corrupt.mutation(internal.contentRelease.manifest.abort, {
          releaseId: ABORT_RELEASE_ID,
        })
      ).rejects.toMatchObject({
        data: {
          code: "CONTENT_RELEASE_INTEGRITY",
        },
      });
      expect(await read()).toEqual(before);
    }
  });
  it("fails closed before completion while directory ownership remains", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      await seedAbortRelease(ctx);
      await ctx.db.insert("contentKeys", {
        contentKey: "test:orphaned-directory",
        createdSequence: 1,
        family: "material",
        artifactLocale: "en",
      });
    });
    await expect(
      t.mutation((ctx) => Effect.runPromise(abort(ctx)))
    ).rejects.toMatchObject({
      code: "CONTENT_RELEASE_INTEGRITY",
    });
  });
});
