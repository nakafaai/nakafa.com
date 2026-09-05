import { assert, describe, expect, it } from "@effect/vitest";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import { ensureCompaction } from "@repo/backend/convex/contentRelease/compact/state";
import { decodeReleaseJson } from "@repo/backend/convex/contentRelease/parse";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  compactionIdentity,
  insertCompletedRelease,
  seedCompactionHistory,
} from "@repo/backend/test/content/compact";
import {
  insertTestState,
  insertZeroRelease,
} from "@repo/backend/test/content/state";
import { convexTest } from "convex-test";

describe("contentRelease/compact/state", () => {
  it("distinguishes a newly persisted cycle, a resumed cycle, and its exact completed floor", async () => {
    const t = convexTest(schema, convexModules);
    expect(
      await t.mutation((ctx) => runConvexProgram(ensureCompaction(ctx)))
    ).toMatchObject({
      complete: false,
      cycle: { floor: 1, phase: "heads", state: { nextSequence: 1 } },
    });
    const resumed = await t.mutation((ctx) =>
      runConvexProgram(ensureCompaction(ctx))
    );
    expect(resumed).toMatchObject({
      complete: false,
      cycle: { state: { compactPhase: "heads" } },
    });
    await t.mutation(async (ctx) => {
      const state = await ctx.db.query("contentState").unique();
      assert.ok(state);
      await ctx.db.patch("contentState", state._id, {
        compactFloor: undefined,
        compactFrom: undefined,
        compactPhase: undefined,
        compactStartedAt: undefined,
        compactedFloor: 1,
      });
    });
    expect(
      await t.mutation((ctx) => runConvexProgram(ensureCompaction(ctx)))
    ).toEqual({ complete: true, floor: 1 });
  });

  it.each([
    { nextSequence: 0 },
    { compactedFloor: -1 },
    { compactedFloor: 3 },
    { activeReleaseId: "incomplete" },
    { compactPhase: "heads" },
    { compactCursor: "orphaned-production-cursor" },
  ] satisfies Partial<Doc<"contentState">>[])(
    "rejects invalid lifecycle state %j",
    async (patch) => {
      const t = convexTest(schema, convexModules);
      await t.mutation(async (ctx) => {
        await insertTestState(ctx, { nextSequence: 2 });
        const state = await ctx.db.query("contentState").unique();
        assert.ok(state);
        await ctx.db.patch("contentState", state._id, patch);
      });
      await expect(
        t.mutation((ctx) => runConvexProgram(ensureCompaction(ctx)))
      ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_INTEGRITY" } });
    }
  );

  it("protects a first active release with no predecessor", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      const active = compactionIdentity(1);
      await insertCompletedRelease(ctx, active);
      await insertTestState(ctx, { active, nextSequence: 2 });
    });
    expect(
      await t.mutation((ctx) => runConvexProgram(ensureCompaction(ctx)))
    ).toMatchObject({ complete: false, cycle: { floor: 1 } });
  });

  it.each([
    "active-sequence",
    "base-sequence",
    "base-hash",
    "partial-base",
  ] as const)("rejects changed %s identity", async (mutation) => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      const base = compactionIdentity(1);
      const active = compactionIdentity(2);
      await insertCompletedRelease(ctx, base);
      await insertCompletedRelease(ctx, active, base);
      await insertTestState(ctx, { active, nextSequence: 3 });
      const row = await ctx.db
        .query("contentReleases")
        .withIndex("by_releaseId", (q) =>
          q.eq(
            "releaseId",
            mutation === "base-sequence" ? base.releaseId : active.releaseId
          )
        )
        .unique();
      assert.ok(row);
      if (mutation === "active-sequence" || mutation === "base-sequence") {
        await ctx.db.patch("contentReleases", row._id, { sequence: 0 });
      } else {
        const signed = await runConvexProgram(
          decodeReleaseJson(row.releaseJson)
        );
        await ctx.db.patch("contentReleases", row._id, {
          releaseJson: JSON.stringify({
            ...signed,
            manifest: {
              ...signed.manifest,
              baseManifestHash:
                mutation === "partial-base" ? null : `sha256:${"f".repeat(64)}`,
            },
          }),
        });
      }
    });
    await expect(
      t.mutation((ctx) => runConvexProgram(ensureCompaction(ctx)))
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_INTEGRITY" } });
  });

  it("rejects invalid completed release sequences outside active slots", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      await insertCompletedRelease(ctx, compactionIdentity(0));
      await insertTestState(ctx, { nextSequence: 1 });
    });
    await expect(
      t.mutation((ctx) => runConvexProgram(ensureCompaction(ctx)))
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_INTEGRITY" } });
  });

  it("rejects duplicate retained sequence numbers before deleting any history", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      for (const releaseId of ["first", "duplicate"]) {
        await insertZeroRelease(ctx, {
          ...compactionIdentity(1),
          releaseId,
          ownership: { base: [], result: [] },
          role: "candidate",
          status: "aborted",
        });
      }
      await insertTestState(ctx, { nextSequence: 3 });
    });
    await expect(
      t.mutation((ctx) => runConvexProgram(ensureCompaction(ctx)))
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_INTEGRITY" } });
  });

  it("retains a permanent runtime before a newer release retention boundary", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      await seedCompactionHistory(ctx);
      const recent = await ctx.db
        .query("contentReleases")
        .withIndex("by_sequence", (q) => q.eq("sequence", 2))
        .unique();
      assert.ok(recent);
      await ctx.db.patch("contentReleases", recent._id, {
        createdAt: Date.now(),
      });
      await ctx.db.insert("tryoutRuntimeBundles", {
        bundleHash: "technical",
        bundleJson: "{}",
        createdAt: 0,
        rendererJson: "{}",
        rendererManifestHash: "technical",
        snapshotId: "technical",
        sourceGitSha: "technical",
        sourceManifestHash: compactionIdentity(1).manifestHash,
        sourceReleaseId: compactionIdentity(1).releaseId,
      });
    });
    expect(
      await t.mutation((ctx) => runConvexProgram(ensureCompaction(ctx)))
    ).toMatchObject({ complete: false, cycle: { floor: 1 } });
  });

  it("advances only through a bounded old-release window", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      for (let sequence = 1; sequence <= 36; sequence += 1) {
        await insertCompletedRelease(ctx, compactionIdentity(sequence));
      }
      await insertTestState(ctx, { nextSequence: 37 });
    });
    expect(
      await t.mutation((ctx) => runConvexProgram(ensureCompaction(ctx)))
    ).toMatchObject({ complete: false, cycle: { floor: 33 } });
  });

  it("keeps history intact when the provider returns an empty unfinished page", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation((ctx) => seedCompactionHistory(ctx));
    await t.mutation(async (ctx) => {
      const before = await ctx.db.query("contentState").unique();
      const read = ctx.db.query.bind(ctx.db);
      const query = vi.spyOn(ctx.db, "query").mockImplementation((table) => {
        const rows = read(table);
        const withIndex = rows.withIndex.bind(rows);
        vi.spyOn(rows, "withIndex").mockImplementation((index, range) => {
          const indexed = withIndex(index, range);
          if (table === "contentReleases") {
            vi.spyOn(indexed, "paginate").mockResolvedValueOnce({
              continueCursor: "byte-limited-page",
              isDone: false,
              page: [],
              pageStatus: "SplitRequired",
            });
          }
          return indexed;
        });
        return rows;
      });
      expect(await runConvexProgram(ensureCompaction(ctx))).toEqual({
        complete: true,
        floor: 0,
      });
      query.mockRestore();
      expect(await ctx.db.query("contentState").unique()).toEqual(before);
      expect(await ctx.db.query("contentReleases").collect()).toHaveLength(5);
      expect(await runConvexProgram(ensureCompaction(ctx))).toMatchObject({
        complete: false,
        cycle: { floor: 4 },
      });
    });
  });
});
