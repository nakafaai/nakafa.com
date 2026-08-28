import { describe, expect, it } from "@effect/vitest";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { compactSnapshots } from "@repo/backend/convex/contentRelease/snapshot/cleanup";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { insertTestRelease } from "@repo/backend/test/content/stage";
import { makeProgramSnapshotData } from "@repo/backend/test/program/snapshot";
import { convexTest } from "convex-test";
import { Effect } from "effect";

/** Inserts one expired manifest and a requested number of physical rows. */
async function insertExpiredProgram(
  ctx: MutationCtx,
  snapshotId: string,
  rowCount: number,
  cleanupAt?: number
) {
  await ctx.db.insert("contentSnapshots", {
    ...(cleanupAt === undefined ? {} : { cleanupAt }),
    createdAt: 0,
    family: "program",
    retainUntil: 0,
    snapshotId,
    snapshotJson: "{}",
  });
  for (let index = 0; index < rowCount; index += 1) {
    await ctx.db.insert("programCatalog", {
      displayOrder: index,
      index,
      programKey: `program-${index}`,
      rowHash: `sha256:${index.toString(16).padStart(64, "0")}`,
      rowJson: "{}",
      snapshotId,
    });
  }
}

describe("contentRelease/snapshot/cleanup", () => {
  it("ignores unexpired snapshots without a cleanup retry", async () => {
    const snapshotId = `sha256:${"6".repeat(64)}`;
    const t = convexTest(schema, convexModules);
    await t.mutation((ctx) =>
      ctx.db.insert("contentSnapshots", {
        createdAt: 0,
        family: "program",
        retainUntil: 1,
        snapshotId,
        snapshotJson: "{}",
      })
    );

    await expect(
      t.mutation((ctx) => runConvexProgram(compactSnapshots(ctx, 0)))
    ).resolves.toEqual({ cursor: null, deleted: 0, done: true });
    await expect(
      t.run((ctx) => ctx.db.query("contentSnapshots").unique())
    ).resolves.toMatchObject({ snapshotId });
  });

  it("deletes expired snapshots through resumable bounded pages", async () => {
    const snapshotId = `sha256:${"7".repeat(64)}`;
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      await insertExpiredProgram(ctx, snapshotId, 3);
      await ctx.db.insert("curriculumRoutes", {
        bucket: "333",
        index: 3,
        level: "track",
        appLocale: "en",
        nodeKey: "program-0:root",
        order: 0,
        programKey: "program-0",
        path: "curriculum/program-0",
        rowHash: `sha256:${"3".padStart(64, "0")}`,
        rowJson: "{}",
        snapshotId,
        sourcePath: "packages/corpus/curriculum/program-0",
      });
      await ctx.db.insert("programBuckets", {
        bucket: "333",
        index: 3,
        appLocale: "en",
        routeCount: 1,
        snapshotId,
      });
    });

    await expect(
      t.mutation((ctx) => runConvexProgram(compactSnapshots(ctx, 0)))
    ).resolves.toEqual({ cursor: null, deleted: 2, done: false });
    await expect(
      t.run(async (ctx) => ({
        curriculum: await ctx.db.query("curriculumRoutes").collect(),
        programs: await ctx.db.query("programCatalog").collect(),
        snapshot: await ctx.db.query("contentSnapshots").unique(),
      }))
    ).resolves.toMatchObject({
      curriculum: [{ index: 3 }],
      programs: [{ index: 2 }],
      snapshot: {
        cleanupAt: 0,
        cleanupIndex: 1,
        cleanupPart: "program",
        cleanupRetryAt: 0,
      },
    });
    await expect(
      t.mutation((ctx) => runConvexProgram(compactSnapshots(ctx, 0)))
    ).resolves.toEqual({ cursor: null, deleted: 1, done: false });
    await expect(
      t.mutation((ctx) => runConvexProgram(compactSnapshots(ctx, 0)))
    ).resolves.toEqual({ cursor: null, deleted: 1, done: false });
    await expect(
      t.mutation((ctx) => runConvexProgram(compactSnapshots(ctx, 0)))
    ).resolves.toEqual({ cursor: null, deleted: 2, done: false });
    await expect(
      t.mutation((ctx) => runConvexProgram(compactSnapshots(ctx, 0)))
    ).resolves.toEqual({ cursor: null, deleted: 0, done: true });
  });

  it("keeps near-limit snapshot bodies inside one bounded transaction", async () => {
    const snapshotId = `sha256:${"8".repeat(64)}`;
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      await insertExpiredProgram(ctx, snapshotId, 0);
      for (let index = 0; index < 3; index += 1) {
        await ctx.db.insert("programCatalog", {
          displayOrder: index,
          index,
          programKey: `program-${index}`,
          rowHash: `sha256:${index.toString(16).padStart(64, "0")}`,
          rowJson: "x".repeat(450_000),
          snapshotId,
        });
      }
    });

    const first = await t.mutation((ctx) =>
      runConvexProgram(compactSnapshots(ctx, 0))
    );
    const pending = await t.run(async (ctx) => ({
      rows: await ctx.db.query("programCatalog").take(3),
      snapshot: await ctx.db.query("contentSnapshots").unique(),
    }));
    expect(first).toEqual({ cursor: null, deleted: 2, done: false });
    expect(pending.rows).toHaveLength(1);
    expect(pending.snapshot).toMatchObject({ cleanupIndex: 1 });
    await expect(
      t.mutation((ctx) => runConvexProgram(compactSnapshots(ctx, 0)))
    ).resolves.toEqual({ cursor: null, deleted: 1, done: false });
    await expect(
      t.mutation((ctx) => runConvexProgram(compactSnapshots(ctx, 0)))
    ).resolves.toEqual({ cursor: null, deleted: 0, done: false });
    await expect(
      t.mutation((ctx) => runConvexProgram(compactSnapshots(ctx, 0)))
    ).resolves.toEqual({ cursor: null, deleted: 1, done: false });
  });

  it("cleans try-out tables in separate durable physical phases", async () => {
    const snapshotId = `sha256:${"9".repeat(64)}`;
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      await ctx.db.insert("contentSnapshots", {
        createdAt: 0,
        family: "tryout",
        retainUntil: 0,
        snapshotId,
        snapshotJson: "{}",
      });
      for (const index of [0]) {
        await ctx.db.insert("tryoutCatalog", {
          assetId: `asset:en:tryout:catalog-${index}`,
          identity: `catalog-${index}`,
          index,
          kind: "exam",
          appLocale: "en",
          order: index,
          rowHash: `sha256:${index.toString(16).padStart(64, "0")}`,
          rowJson: "{}",
          snapshotId,
        });
      }
      for (const index of [1]) {
        await ctx.db.insert("tryoutPlacements", {
          answerArtifactHash: `sha256:${"a".repeat(64)}`,
          answerArtifactLocale: "en",
          appLocale: "en",
          contentHash: "3".repeat(64),
          countryKey: "indonesia",
          deliveryLanguage: "en",
          examKey: "snbt",
          identity: `placement-${index}`,
          index,
          questionArtifactHash: `sha256:${"b".repeat(64)}`,
          questionArtifactLocale: "en",
          questionOrder: index,
          rowHash: `sha256:${index.toString(16).padStart(64, "0")}`,
          rowJson: "{}",
          snapshotId,
          sectionKey: "quantitative-knowledge",
          setKey: "set-1",
          trackKey: "2027",
        });
      }
      await ctx.db.insert("tryoutBundles", {
        createdAt: 0,
        index: 0,
        manifestHash: `sha256:${"c".repeat(64)}`,
        releaseId: "release-cleanup",
        releaseJson: "{}",
        rendererJson: "{}",
        snapshotId,
      });
      for (const index of [0, 1, 2]) {
        await ctx.db.insert("tryoutRuntimeBundles", {
          bundleHash: `sha256:${(index + 1).toString(16).repeat(64)}`,
          bundleJson: "{}",
          cleanupReleaseId: `release-cleanup-${index}`,
          createdAt: 0,
          rendererJson: "{}",
          rendererManifestHash: `sha256:${(index + 4).toString(16).repeat(64)}`,
          snapshotId,
          sourceGitSha: "a".repeat(40),
          sourceManifestHash: `sha256:${"b".repeat(64)}`,
          sourceReleaseId: `release-cleanup-${index}`,
        });
      }
    });

    await expect(
      t.mutation((ctx) => runConvexProgram(compactSnapshots(ctx, 0)))
    ).resolves.toEqual({ cursor: null, deleted: 1, done: false });
    await expect(
      t.run((ctx) => ctx.db.query("contentSnapshots").unique())
    ).resolves.toMatchObject({ cleanupPart: "placement" });
    await expect(
      t.mutation((ctx) => runConvexProgram(compactSnapshots(ctx, 0)))
    ).resolves.toEqual({ cursor: null, deleted: 1, done: false });
    await expect(
      t.run(async (ctx) => ({
        bundle: await ctx.db.query("tryoutBundles").take(1),
        catalog: await ctx.db.query("tryoutCatalog").take(1),
        placement: await ctx.db.query("tryoutPlacements").take(1),
        runtime: await ctx.db.query("tryoutRuntimeBundles").take(3),
      }))
    ).resolves.toEqual({
      bundle: [expect.objectContaining({ snapshotId })],
      catalog: [],
      placement: [],
      runtime: [
        expect.objectContaining({ snapshotId }),
        expect.objectContaining({ snapshotId }),
        expect.objectContaining({ snapshotId }),
      ],
    });
    await expect(
      t.mutation((ctx) => runConvexProgram(compactSnapshots(ctx, 0)))
    ).resolves.toEqual({ cursor: null, deleted: 1, done: false });
    await expect(
      t.run((ctx) => ctx.db.query("contentSnapshots").unique())
    ).resolves.toMatchObject({ cleanupPart: "runtime" });
    await expect(
      t.mutation((ctx) => runConvexProgram(compactSnapshots(ctx, 0)))
    ).resolves.toEqual({ cursor: null, deleted: 2, done: false });
    await expect(
      t.run((ctx) => ctx.db.query("contentSnapshots").unique())
    ).resolves.toMatchObject({ cleanupPart: "runtime" });
    await expect(
      t.mutation((ctx) => runConvexProgram(compactSnapshots(ctx, 0)))
    ).resolves.toEqual({ cursor: null, deleted: 2, done: false });
    await expect(
      t.run(async (ctx) => ({
        bundle: await ctx.db.query("tryoutBundles").take(1),
        runtime: await ctx.db.query("tryoutRuntimeBundles").take(1),
        snapshot: await ctx.db.query("contentSnapshots").take(1),
      }))
    ).resolves.toEqual({ bundle: [], runtime: [], snapshot: [] });
  });

  it("cleans signed Quran rows and search projections in separate phases", async () => {
    const snapshotId = `sha256:${"a".repeat(64)}`;
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      await ctx.db.insert("contentSnapshots", {
        createdAt: 0,
        family: "quran",
        retainUntil: 0,
        snapshotId,
        snapshotJson: "{}",
      });
      await ctx.db.insert("quranRows", {
        identity: "search:en:1",
        index: 0,
        kind: "quran-search",
        appLocale: "en",
        rowHash: `sha256:${"b".repeat(64)}`,
        rowJson: "{}",
        snapshotId,
        surahNumber: 1,
      });
      await ctx.db.insert("quranSearch", {
        assetId: "asset:en:quran:quran-search:1",
        identity: "search:en:1",
        index: 0,
        appLocale: "en",
        rowHash: `sha256:${"b".repeat(64)}`,
        snapshotId,
        surahNumber: 1,
        text: "technical search",
      });
    });

    await expect(
      t.mutation((ctx) => runConvexProgram(compactSnapshots(ctx, 0)))
    ).resolves.toEqual({ cursor: null, deleted: 1, done: false });
    await expect(
      t.run((ctx) => ctx.db.query("contentSnapshots").unique())
    ).resolves.toMatchObject({ cleanupPart: "quran-search" });
    await expect(
      t.mutation((ctx) => runConvexProgram(compactSnapshots(ctx, 0)))
    ).resolves.toEqual({ cursor: null, deleted: 2, done: false });
    await expect(
      t.run(async (ctx) => ({
        rows: await ctx.db.query("quranRows").take(1),
        search: await ctx.db.query("quranSearch").take(1),
        snapshot: await ctx.db.query("contentSnapshots").take(1),
      }))
    ).resolves.toEqual({ rows: [], search: [], snapshot: [] });
  });

  it.live(
    "extends retained snapshots selected by protected release history",
    () =>
      Effect.gen(function* () {
        const data = yield* makeProgramSnapshotData();
        const t = convexTest(schema, convexModules);
        yield* Effect.promise(() =>
          t.mutation((ctx) =>
            insertTestRelease(ctx, { snapshots: data.snapshots })
          )
        );
        yield* Effect.promise(() =>
          t.mutation((ctx) => insertExpiredProgram(ctx, data.snapshotId, 0))
        );

        yield* Effect.promise(() =>
          expect(
            t.mutation((ctx) => runConvexProgram(compactSnapshots(ctx, 0)))
          ).resolves.toEqual({ cursor: null, deleted: 0, done: false })
        );
        yield* Effect.promise(() =>
          expect(
            t.run((ctx) => ctx.db.query("contentSnapshots").unique())
          ).resolves.toMatchObject({ retainUntil: expect.any(Number) })
        );
      })
  );

  it.live(
    "fails closed when a partially cleaned snapshot becomes referenced",
    () =>
      Effect.gen(function* () {
        const data = yield* makeProgramSnapshotData();
        const t = convexTest(schema, convexModules);
        yield* Effect.promise(() =>
          t.mutation((ctx) =>
            insertTestRelease(ctx, { snapshots: data.snapshots })
          )
        );
        yield* Effect.promise(() =>
          t.mutation((ctx) => insertExpiredProgram(ctx, data.snapshotId, 0, 0))
        );

        yield* Effect.promise(() =>
          expect(
            t.mutation((ctx) => runConvexProgram(compactSnapshots(ctx, 0)))
          ).rejects.toMatchObject({
            data: { code: "CONTENT_RELEASE_INTEGRITY" },
          })
        );
      })
  );
});
