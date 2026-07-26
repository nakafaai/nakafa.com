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
} from "@repo/backend/test/content-compact";
import {
  insertTestState,
  insertZeroRelease,
} from "@repo/backend/test/content-state";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

describe("contentRelease/compact", () => {
  it("resumes pages and preserves floor anchors before collecting history", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      await seedCompactionHistory(ctx);
      await ctx.db.insert("contentIndex", {
        contentKey: "test:compact-0",
        family: "material",
        locale: "en",
        projectionHash: `sha256:${"4".repeat(64)}`,
        publicPath: "test/compact-0",
        releaseId: "release-compact-4",
        sequence: 4,
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
      owners: await ctx.db.query("contentOwners").collect(),
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
    expect(stored.owners).toMatchObject([{ managed: true, sequence: 3 }]);
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

  it("does not persist a compaction cycle before ownership migration", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      const first = compactionIdentity(1);
      const base = compactionIdentity(2);
      const active = compactionIdentity(3);
      await insertZeroRelease(ctx, {
        ...first,
        role: "candidate",
        status: "completed",
      });
      await insertZeroRelease(ctx, {
        ...base,
        base: first,
        role: "candidate",
        status: "completed",
      });
      await insertZeroRelease(ctx, {
        ...active,
        base,
        role: "candidate",
        status: "completed",
      });
      await insertTestState(ctx, { active, nextSequence: 4 });
      const firstRelease = await ctx.db
        .query("contentReleases")
        .withIndex("by_releaseId", (query) =>
          query.eq("releaseId", first.releaseId)
        )
        .unique();
      expect(firstRelease).toBeDefined();
      if (!firstRelease) {
        return;
      }
      await ctx.db.patch("contentReleases", firstRelease._id, {
        createdAt: COMPACTION_OLD_TIME,
      });
    });

    await expect(
      t.mutation((ctx) => runConvexProgram(compactProgram(ctx)))
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_STATE" },
    });
    const blocked = await t.run((ctx) => ctx.db.query("contentState").unique());
    expect(blocked).toMatchObject({ nextSequence: 4 });
    expect(blocked?.compactCursor).toBeUndefined();
    expect(blocked?.compactFloor).toBeUndefined();
    expect(blocked?.compactFrom).toBeUndefined();
    expect(blocked?.compactPhase).toBeUndefined();
    expect(blocked?.compactStartedAt).toBeUndefined();

    await expect(
      t.mutation(internal.contentRelease.scope.migrate.migrateOwnership, {
        apply: true,
        expectedOwners: 0,
        expectedReleases: 3,
      })
    ).resolves.toMatchObject({
      pendingOwners: 0,
      pendingReleases: 3,
      updatedReleases: 3,
    });
    await expect(
      t.mutation((ctx) => runConvexProgram(compactProgram(ctx)))
    ).resolves.toMatchObject({ complete: false, floor: 2, phase: "heads" });
  });

  it("freezes artifact expiry at the durable cycle start", async () => {
    const t = convexTest(schema, convexModules);
    const expiredHash = `sha256:${"1".repeat(64)}`;
    const futureHash = `sha256:${"2".repeat(64)}`;
    await t.mutation(async (ctx) => {
      await ctx.db.insert("contentState", {
        compactFloor: 1,
        compactFrom: 0,
        compactPhase: "artifacts",
        compactStartedAt: 0,
        key: "primary",
        nextSequence: 2,
        updatedAt: 0,
      });
      for (const [artifactHash, retainUntil] of [
        [expiredHash, 0],
        [futureHash, 1],
      ] as const) {
        await ctx.db.insert("contentArtifacts", {
          artifactHash,
          artifactJson: "{}",
          createdAt: 0,
          retainUntil,
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
        compactFloor: 1,
        compactFrom: 0,
        compactPhase: "artifacts",
        compactStartedAt: 1,
        key: "primary",
        nextSequence: 2,
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
        role: "candidate",
        status: "verified",
      });
      await insertZeroRelease(ctx, {
        ...recovery,
        base: candidate,
        originReleaseId: candidate.releaseId,
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
