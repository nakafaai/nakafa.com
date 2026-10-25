import { assert, describe, expect, it } from "@effect/vitest";
import { SignedContentReleaseSchema } from "@nakafa/aksara-contracts/release";
import { convexModules } from "@repo/backend/confect/test.setup";
import schema from "@repo/backend/convex/schema";
import {
  COMPACTION_OLD_TIME,
  compact,
  compactionIdentity,
  insertCompletedRelease,
  markBootstrap,
} from "@repo/backend/test/content/compact";
import {
  insertTestState,
  insertZeroRelease,
} from "@repo/backend/test/content/state";
import { encodeJsonText } from "@repo/utilities/json";
import { convexTest } from "convex-test";
import { DateTime, Schema } from "effect";

const NOW = DateTime.toEpochMillis(DateTime.nowUnsafe());

describe("contentRelease/compact/protected", () => {
  it("protects a first active release with no predecessor", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      const active = compactionIdentity(1);
      await insertCompletedRelease(ctx, active);
      await insertTestState(ctx, {
        active,
        nextSequence: 2,
      });
    });
    expect(await compact(t)).toMatchObject({
      complete: false,
      cycle: {
        floor: 1,
      },
    });
  });
  it("rejects a slot identity whose manifest hash drifted from the stored release", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      const base = compactionIdentity(1);
      const active = compactionIdentity(2);
      await insertCompletedRelease(ctx, base);
      await insertCompletedRelease(ctx, active, base);
      await insertTestState(ctx, {
        active,
        nextSequence: 3,
      });
      const state = await ctx.db.query("contentState").unique();
      assert.ok(state);
      await ctx.db.patch("contentState", state._id, {
        activeManifestHash: `sha256:${"e".repeat(64)}`,
      });
    });
    await expect(compact(t)).rejects.toMatchObject({
      code: "CONTENT_RELEASE_INTEGRITY",
    });
  });
  it("fails closed while a slot references a missing release and no history exists", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation((ctx) =>
      insertTestState(ctx, {
        active: {
          manifestHash: `sha256:${"a".repeat(64)}`,
          releaseId: "release-missing",
          sequence: 1,
        },
        nextSequence: 2,
      })
    );
    expect(await compact(t)).toMatchObject({
      complete: false,
      cycle: {
        floor: 2,
      },
    });
  });
  it("fails closed to the earliest stored release when a slot release is missing", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      const base = compactionIdentity(1);
      await insertCompletedRelease(ctx, base);
      await insertTestState(ctx, {
        active: {
          manifestHash: `sha256:${"a".repeat(64)}`,
          releaseId: "release-missing",
          sequence: 1,
        },
        nextSequence: 3,
      });
    });
    expect(await compact(t)).toMatchObject({
      complete: false,
      cycle: {
        floor: 1,
      },
    });
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
      await insertTestState(ctx, {
        active,
        nextSequence: 3,
      });
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
        await ctx.db.patch("contentReleases", row._id, {
          sequence: 0,
        });
      } else {
        await ctx.db.patch("contentReleases", row._id, {
          baseManifestHash:
            mutation === "partial-base" ? null : `sha256:${"f".repeat(64)}`,
        });
      }
    });
    await expect(compact(t)).rejects.toMatchObject({
      code: "CONTENT_RELEASE_INTEGRITY",
    });
  });
  it("resolves a protected floor when the base stored a manifest the content contract rejects", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      const base = compactionIdentity(1);
      const active = compactionIdentity(2);
      await insertCompletedRelease(ctx, base);
      await insertCompletedRelease(ctx, active, base);
      await insertTestState(ctx, {
        active,
        nextSequence: 3,
      });
      const row = await ctx.db
        .query("contentReleases")
        .withIndex("by_releaseId", (q) => q.eq("releaseId", base.releaseId))
        .unique();
      assert.ok(row);
      const stored = Schema.decodeSync(
        Schema.fromJsonString(SignedContentReleaseSchema),
        { onExcessProperty: "error" }
      )(row.releaseJson);
      // Plain codec: a typed encode would strip the excess manifest field.
      await ctx.db.patch("contentReleases", row._id, {
        releaseJson: encodeJsonText({
          ...stored,
          manifest: {
            ...stored.manifest,
            rendererContractVersion: "1.0.0",
          },
        }),
      });
    });
    expect(await compact(t)).toMatchObject({
      complete: false,
      cycle: {
        floor: 1,
      },
    });
  });
  it("rejects invalid completed release sequences outside active slots", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      await insertCompletedRelease(ctx, compactionIdentity(0));
      await insertTestState(ctx, {
        nextSequence: 1,
      });
    });
    await expect(compact(t)).rejects.toMatchObject({
      code: "CONTENT_RELEASE_INTEGRITY",
    });
  });
  it("drops the retired base of a bootstrap even while that base is inside retention", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      const retired = compactionIdentity(1);
      const bootstrap = compactionIdentity(2);
      await insertCompletedRelease(ctx, retired, undefined, NOW);
      await insertCompletedRelease(ctx, bootstrap, retired, NOW);
      await markBootstrap(ctx, bootstrap);
      await insertTestState(ctx, { active: bootstrap, nextSequence: 3 });
    });
    expect(await compact(t)).toMatchObject({
      complete: false,
      cycle: {
        floor: 2,
        from: 0,
        phase: "heads",
      },
    });
  });
  it("keeps compacting when the retired base of a bootstrap is already deleted", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      const retired = compactionIdentity(2);
      const bootstrap = compactionIdentity(3);
      const active = compactionIdentity(4);
      await insertCompletedRelease(ctx, bootstrap, retired, NOW);
      await markBootstrap(ctx, bootstrap);
      await insertCompletedRelease(ctx, active, bootstrap, NOW);
      await insertTestState(ctx, { active, nextSequence: 5 });
    });
    expect(await compact(t)).toMatchObject({
      complete: false,
      cycle: {
        floor: 3,
      },
    });
  });
  it("does not protect a completed release below the bootstrap floor", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      const retired = compactionIdentity(1);
      const bootstrap = compactionIdentity(2);
      await insertCompletedRelease(ctx, retired, undefined, NOW);
      await insertCompletedRelease(ctx, bootstrap, undefined, NOW);
      await markBootstrap(ctx, bootstrap);
      await insertTestState(ctx, { active: bootstrap, nextSequence: 3 });
    });
    expect(await compact(t)).toMatchObject({
      complete: false,
      cycle: {
        floor: 2,
      },
    });
  });
  it("keeps the bootstrap protected while dropping only the retired base beneath it", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      const retired = compactionIdentity(1);
      const bootstrap = compactionIdentity(2);
      const above = compactionIdentity(3);
      await insertCompletedRelease(
        ctx,
        retired,
        undefined,
        COMPACTION_OLD_TIME
      );
      await insertCompletedRelease(
        ctx,
        bootstrap,
        retired,
        COMPACTION_OLD_TIME
      );
      await markBootstrap(ctx, bootstrap);
      await insertCompletedRelease(ctx, above, bootstrap, NOW);
      await insertTestState(ctx, { active: above, nextSequence: 4 });
    });
    expect(await compact(t)).toMatchObject({
      complete: false,
      cycle: {
        floor: 2,
      },
    });
  });
  it("does not let a slot below the bootstrap floor hold the floor down", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      const retired = compactionIdentity(1);
      const bootstrap = compactionIdentity(2);
      await insertCompletedRelease(
        ctx,
        retired,
        undefined,
        COMPACTION_OLD_TIME
      );
      await insertCompletedRelease(
        ctx,
        bootstrap,
        undefined,
        COMPACTION_OLD_TIME
      );
      await markBootstrap(ctx, bootstrap);
      await insertTestState(ctx, {
        active: bootstrap,
        nextSequence: 3,
        recovery: {
          manifestHash: `sha256:${"d".repeat(64)}`,
          releaseId: "release-missing",
          sequence: 1,
        },
      });
    });
    expect(await compact(t)).toMatchObject({
      complete: false,
      cycle: {
        floor: 2,
      },
    });
  });
  it("fails closed to the bootstrap floor, not the earliest retired release, when a slot is missing", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      const retired = compactionIdentity(1);
      const bootstrap = compactionIdentity(2);
      await insertCompletedRelease(
        ctx,
        retired,
        undefined,
        COMPACTION_OLD_TIME
      );
      await insertCompletedRelease(
        ctx,
        bootstrap,
        undefined,
        COMPACTION_OLD_TIME
      );
      await markBootstrap(ctx, bootstrap);
      await insertTestState(ctx, {
        active: {
          manifestHash: `sha256:${"a".repeat(64)}`,
          releaseId: "release-missing",
          sequence: 3,
        },
        nextSequence: 4,
      });
    });
    expect(await compact(t)).toMatchObject({
      complete: false,
      cycle: {
        floor: 2,
      },
    });
  });
  it("keeps releases above the bootstrap protected by today's rules", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      const bootstrap = compactionIdentity(2);
      const first = compactionIdentity(3);
      const second = compactionIdentity(4);
      const active = compactionIdentity(5);
      await insertCompletedRelease(
        ctx,
        bootstrap,
        compactionIdentity(1),
        COMPACTION_OLD_TIME
      );
      await markBootstrap(ctx, bootstrap);
      await insertCompletedRelease(ctx, first, bootstrap, COMPACTION_OLD_TIME);
      await insertCompletedRelease(ctx, second, first, NOW);
      await insertCompletedRelease(ctx, active, second, NOW);
      await insertTestState(ctx, { active, nextSequence: 6 });
    });
    expect(await compact(t)).toMatchObject({
      complete: false,
      cycle: {
        floor: 3,
      },
    });
  });
  it("does not load the base of a completed release below the bootstrap floor", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      const deleted = compactionIdentity(1);
      const retired = compactionIdentity(2);
      const bootstrap = compactionIdentity(3);
      await insertCompletedRelease(ctx, retired, deleted, NOW);
      await insertCompletedRelease(ctx, bootstrap, retired, NOW);
      await markBootstrap(ctx, bootstrap);
      await insertTestState(ctx, { active: bootstrap, nextSequence: 4 });
    });
    expect(await compact(t)).toMatchObject({
      complete: false,
      cycle: {
        floor: 3,
      },
    });
  });
  it("never lets a base below the bootstrap floor lower the floor", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      const retired = compactionIdentity(1);
      const bootstrap = compactionIdentity(2);
      const above = compactionIdentity(3);
      await insertCompletedRelease(
        ctx,
        retired,
        undefined,
        COMPACTION_OLD_TIME
      );
      await insertCompletedRelease(
        ctx,
        bootstrap,
        undefined,
        COMPACTION_OLD_TIME
      );
      await markBootstrap(ctx, bootstrap);
      await insertCompletedRelease(ctx, above, retired, NOW);
      await insertTestState(ctx, { active: above, nextSequence: 4 });
    });
    expect(await compact(t)).toMatchObject({
      complete: false,
      cycle: {
        floor: 2,
      },
    });
  });
  it("sets no bootstrap floor until the bootstrap completes", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      const retained = compactionIdentity(1);
      await insertCompletedRelease(ctx, retained, undefined, NOW);
      await insertZeroRelease(ctx, {
        ...compactionIdentity(2),
        bootstrap: true,
        ownership: { base: [], result: [] },
        role: "candidate",
        status: "verified",
      });
      await insertTestState(ctx, { active: retained, nextSequence: 3 });
    });
    expect(await compact(t)).toMatchObject({
      complete: false,
      cycle: {
        floor: 1,
      },
    });
  });
});
