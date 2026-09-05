import { afterEach, describe, expect, it } from "@effect/vitest";
import { internal } from "@repo/backend/convex/_generated/api";
import {
  compactProgram,
  runProgram,
} from "@repo/backend/convex/contentRelease/compact";
import { ARTIFACT_PAGE_COUNT } from "@repo/backend/convex/contentRelease/spec";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  COMPACTION_OLD_TIME,
  compactionIdentity,
  insertCompletedRelease,
  seedCompactionHistory,
} from "@repo/backend/test/content/compact";
import {
  insertTestState,
  insertZeroRelease,
} from "@repo/backend/test/content/state";
import { convexTest } from "convex-test";
import { Effect } from "effect";

afterEach(() => vi.unstubAllEnvs());

describe("contentRelease/compact", () => {
  it("yields a large expired snapshot backlog across bounded scheduled runs", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      await ctx.db.insert("contentState", {
        articleSlot: "blue",
        materialSlot: "blue",
        searchSlot: "blue",
        key: "primary",
        nextSequence: 2,
        updatedAt: 0,
        compactFloor: 1,
        compactFrom: 0,
        compactPhase: "snapshots",
        compactStartedAt: 1,
      });
      for (let index = 0; index < 70; index += 1) {
        await ctx.db.insert("contentSnapshots", {
          createdAt: 0,
          family: "program",
          retainUntil: 0,
          snapshotId: `expired-${index}`,
          snapshotJson: "{}",
        });
      }
    });
    const paused = await t.action(internal.contentRelease.compact.run, {});
    expect(paused).toMatchObject({
      complete: false,
      floor: 1,
      phase: "snapshots",
    });
    const remaining = await t.query((ctx) =>
      ctx.db.query("contentSnapshots").collect()
    );
    expect(remaining.length).toBeGreaterThan(0);
    expect(remaining.length).toBeLessThan(70);
    let completed = false;
    for (let run = 0; run < 4; run += 1) {
      if ((await t.action(internal.contentRelease.compact.run, {})).complete) {
        completed = true;
        break;
      }
    }
    expect(completed).toBe(true);
    expect(
      await t.query((ctx) => ctx.db.query("contentSnapshots").collect())
    ).toEqual([]);
    expect(
      await t.query((ctx) => ctx.db.query("contentState").unique())
    ).toMatchObject({ compactedFloor: 1 });
  });

  it("skips local static builds before reading lifecycle state or dispatching pages", async () => {
    vi.stubEnv("CONTENT_RUNTIME_BUILD", "local-static");
    vi.stubEnv("CONVEX_CLOUD_URL", "http://127.0.0.1:3210");
    vi.stubEnv("CONVEX_SITE_URL", "http://127.0.0.1:3211");
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      const read = vi.spyOn(ctx.db, "query");
      expect(await runConvexProgram(compactProgram(ctx))).toEqual({
        complete: true,
        deleted: 0,
        floor: 0,
        phase: "releases",
      });
      expect(read).not.toHaveBeenCalled();
    });
    await t.action(async (ctx) => {
      const dispatch = vi.spyOn(ctx, "runMutation");
      expect(await runConvexProgram(runProgram(ctx))).toMatchObject({
        complete: true,
        deleted: 0,
      });
      expect(dispatch).not.toHaveBeenCalled();
    });
  });

  it.each([
    ["invalid", "http://127.0.0.1:3210", "http://127.0.0.1:3211"],
    [
      "local-static",
      "https://production.convex.cloud",
      "https://production.convex.site",
    ],
    ["local-static", "http://localhost:3210", "http://127.0.0.1:3211"],
    ["local-static", "http://127.0.0.1:3210", "http://127.0.0.1:3210"],
  ])(
    "rejects unsafe build configuration before DB reads: %s %s %s",
    async (mode, cloud, site) => {
      vi.stubEnv("CONTENT_RUNTIME_BUILD", mode);
      vi.stubEnv("CONVEX_CLOUD_URL", cloud);
      vi.stubEnv("CONVEX_SITE_URL", site);
      const t = convexTest(schema, convexModules);
      await t.mutation(async (ctx) => {
        const read = vi.spyOn(ctx.db, "query");
        const failure = await runConvexProgram(
          compactProgram(ctx).pipe(Effect.flip, Effect.orDie)
        );
        expect(failure).toMatchObject({
          _tag: "ReleaseError",
          code: "CONTENT_RELEASE_STATE",
        });
        expect(read).not.toHaveBeenCalled();
      });
    }
  );

  it("resumes pages and preserves floor anchors before collecting history", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      await seedCompactionHistory(ctx);
      await ctx.db.insert("contentIndex", {
        contentKey: "test:compact-0",
        family: "material",
        appLocale: "en",
        projectionHash: `sha256:${"4".repeat(64)}`,
        publicPath: "test/compact-0",
        releaseId: "release-compact-4",
        sequence: 4,
        slot: "blue",
        text: "active search entry",
      });
    });

    const first = await t.mutation((ctx) =>
      runConvexProgram(compactProgram(ctx))
    );
    const paused = await t.run((ctx) => ctx.db.query("contentState").unique());
    expect(first).toMatchObject({ complete: false, floor: 4, phase: "heads" });
    expect(paused?.compactCursor).toBeUndefined();
    expect(paused?.compactPhase).toBe("heads");
    expect(paused?.compactedFloor).toBeUndefined();

    const completed = await t.action((ctx) =>
      runConvexProgram(runProgram(ctx))
    );
    const stored = await t.run(async (ctx) => ({
      artifacts: await ctx.db.query("contentArtifacts").collect(),
      bindings: await ctx.db.query("contentBindings").collect(),
      heads: await ctx.db.query("contentHeads").collect(),
      items: await ctx.db.query("contentItems").collect(),
      search: await ctx.db.query("contentIndex").collect(),
      releases: await ctx.db.query("contentReleases").collect(),
      state: await ctx.db.query("contentState").unique(),
    }));
    expect(completed).toMatchObject({ complete: true, floor: 4 });
    expect(stored.heads).toHaveLength(42);
    expect(
      stored.heads.find((row) => row.contentKey === "test:anchor")
    ).toMatchObject({ sequence: 3 });
    expect(stored.bindings.map((row) => row.sequence).sort()).toEqual([3, 4]);
    expect(stored.items).toHaveLength(0);
    expect(stored.search).toMatchObject([
      { contentKey: "test:compact-0", sequence: 4 },
    ]);
    expect(stored.releases.map((row) => row.sequence).sort()).toEqual([4, 5]);
    expect(stored.artifacts.map((row) => row.artifactHash).sort()).toEqual([
      `sha256:${"c".repeat(64)}`,
      `sha256:${"d".repeat(64)}`,
      `sha256:${"f".repeat(64)}`,
    ]);
    expect(
      stored.artifacts.find(
        ({ artifactHash }) => artifactHash === `sha256:${"c".repeat(64)}`
      )?.retainUntil
    ).toBeGreaterThan(Date.now());
    expect(stored.state).toMatchObject({ compactedFloor: 4 });
    expect(stored.state?.compactPhase).toBeUndefined();

    await expect(
      t.action((ctx) => runConvexProgram(runProgram(ctx)))
    ).resolves.toEqual({
      complete: true,
      deleted: 0,
      floor: 4,
      phase: "releases",
    });
  });

  it("stops before a recent unreachable release", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      const releases = Array.from({ length: 5 }, (_, index) =>
        compactionIdentity(index + 1)
      );
      for (const [index, release] of releases.entries()) {
        await insertCompletedRelease(
          ctx,
          release,
          releases[index - 1],
          index === 1 ? Date.now() : COMPACTION_OLD_TIME
        );
      }
      const fifth = releases[4];
      if (!fifth) {
        throw new Error("Expected recent compaction releases.");
      }
      await insertTestState(ctx, { active: fifth, nextSequence: 6 });
    });

    const receipt = await t.action((ctx) => runConvexProgram(runProgram(ctx)));
    const sequences = await t.run(async (ctx) =>
      (await ctx.db.query("contentReleases").collect()).map(
        (release) => release.sequence
      )
    );
    expect(receipt).toMatchObject({ complete: true, floor: 2 });
    expect(sequences.sort()).toEqual([2, 3, 4, 5]);
  });

  it("freezes artifact expiry at the durable cycle start", async () => {
    const t = convexTest(schema, convexModules);
    const expiredHash = `sha256:${"1".repeat(64)}`;
    const futureHash = `sha256:${"2".repeat(64)}`;
    await t.mutation(async (ctx) => {
      await ctx.db.insert("contentState", {
        articleSlot: "blue",
        compactFloor: 1,
        compactFrom: 0,
        compactPhase: "artifacts",
        compactStartedAt: 0,
        key: "primary",
        materialSlot: "blue",
        nextSequence: 2,
        searchSlot: "blue",
        updatedAt: 0,
      });
      for (const artifact of [
        { artifactHash: expiredHash, retainUntil: 0 },
        { artifactHash: futureHash, retainUntil: 1 },
      ]) {
        await ctx.db.insert("contentArtifacts", {
          artifactHash: artifact.artifactHash,
          artifactJson: "{}",
          createdAt: 0,
          retainUntil: artifact.retainUntil,
        });
      }
    });

    await expect(
      t.mutation((ctx) => runConvexProgram(compactProgram(ctx)))
    ).resolves.toMatchObject({
      complete: false,
      deleted: 1,
      phase: "snapshots",
    });
    await expect(
      t.mutation((ctx) => runConvexProgram(compactProgram(ctx)))
    ).resolves.toMatchObject({
      complete: false,
      floor: 1,
      phase: "releases",
    });
    await expect(
      t.mutation((ctx) => runConvexProgram(compactProgram(ctx)))
    ).resolves.toMatchObject({ complete: true, floor: 1 });
    const hashes = await t.run(async (ctx) =>
      (await ctx.db.query("contentArtifacts").collect()).map(
        ({ artifactHash }) => artifactHash
      )
    );
    expect(hashes).toEqual([futureHash]);
  });

  it("yields artifact compaction at the bounded maintenance page", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      await ctx.db.insert("contentState", {
        articleSlot: "blue",
        compactFloor: 1,
        compactFrom: 0,
        compactPhase: "artifacts",
        compactStartedAt: 1,
        key: "primary",
        materialSlot: "blue",
        nextSequence: 2,
        searchSlot: "blue",
        updatedAt: 0,
      });
      for (let index = 0; index < ARTIFACT_PAGE_COUNT + 1; index += 1) {
        await ctx.db.insert("contentArtifacts", {
          artifactHash: `sha256:${index.toString(16).padStart(64, "0")}`,
          artifactJson: "{}",
          createdAt: 0,
          retainUntil: 0,
        });
      }
    });

    await expect(
      t.mutation((ctx) => runConvexProgram(compactProgram(ctx)))
    ).resolves.toMatchObject({
      complete: false,
      deleted: ARTIFACT_PAGE_COUNT,
      phase: "artifacts",
    });
    await expect(
      t.mutation((ctx) => runConvexProgram(compactProgram(ctx)))
    ).resolves.toMatchObject({
      complete: false,
      deleted: 1,
      phase: "snapshots",
    });
  });

  it("protects exact active bases and retained recovery slots", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      const first = compactionIdentity(1);
      const base = compactionIdentity(2);
      const fourth = compactionIdentity(4);
      const active = compactionIdentity(5);
      const candidate = compactionIdentity(6);
      const recovery = compactionIdentity(7);
      await insertCompletedRelease(ctx, first);
      await insertCompletedRelease(ctx, base, first);
      await insertCompletedRelease(ctx, fourth, base);
      await insertCompletedRelease(ctx, active, base);
      await insertZeroRelease(ctx, {
        ...candidate,
        base: active,
        ownership: {
          base: ["material"],
          result: ["material"],
        },
        role: "candidate",
        status: "verified",
      });
      await insertZeroRelease(ctx, {
        ...recovery,
        base: candidate,
        originReleaseId: candidate.releaseId,
        ownership: {
          base: ["material"],
          result: ["material"],
        },
        role: "recovery",
        status: "verified",
      });
      await insertTestState(ctx, {
        active,
        candidate,
        nextSequence: 8,
        recovery,
      });
    });

    const receipt = await t.action((ctx) => runConvexProgram(runProgram(ctx)));
    const sequences = await t.run(async (ctx) =>
      (await ctx.db.query("contentReleases").collect()).map(
        (release) => release.sequence
      )
    );
    expect(receipt).toMatchObject({ complete: true, floor: 2 });
    expect(sequences.sort()).toEqual([2, 4, 5, 6, 7]);
  });
});
