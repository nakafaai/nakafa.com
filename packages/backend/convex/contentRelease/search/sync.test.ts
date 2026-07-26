import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { syncSearch } from "@repo/backend/convex/contentRelease/search/sync";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { testProjectionJson } from "@repo/backend/test/content-material";
import {
  insertTestState,
  type TestIdentity,
} from "@repo/backend/test/content-state";
import {
  insertCompletedRelease,
  insertReleaseItem,
  selectActiveRelease,
} from "@repo/backend/test/content-sync";
import {
  insertRuntimeBinding,
  insertRuntimeVersion,
} from "@repo/backend/test/runtime-head";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

const BASE = {
  manifestHash: `sha256:${"8".repeat(64)}`,
  releaseId: "release-search-sync-base",
  sequence: 1,
} satisfies TestIdentity;
const NEXT = {
  manifestHash: `sha256:${"9".repeat(64)}`,
  releaseId: "release-search-sync-next",
  sequence: 2,
} satisfies TestIdentity;

/** Inserts one public head selected by the active release sequence. */
async function insertPublicHead(
  ctx: MutationCtx,
  identity: TestIdentity,
  contentKey: string,
  index: number,
  plainText: string
) {
  const publicPath = `test/sync-${index}`;
  await insertRuntimeVersion(ctx, "public", contentKey, {
    artifactHash: `sha256:${(identity.sequence * 32 + index)
      .toString(16)
      .padStart(64, "0")}`,
    headReleaseId: identity.releaseId,
    headSequence: identity.sequence,
    plainText,
    projectionJson: testProjectionJson({ contentKey, publicPath }),
    publicPath,
  });
  await insertRuntimeBinding(ctx, contentKey, {
    bindingReleaseId: identity.releaseId,
    bindingSequence: identity.sequence,
    publicPath,
  });
}

describe("contentRelease/search/sync", () => {
  it("publishes one bounded search model atomically", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      await insertCompletedRelease(ctx, BASE, 8);
      await insertTestState(ctx, { active: BASE, nextSequence: 2 });
      for (let index = 0; index < 8; index += 1) {
        const contentKey = `test:sync-${index}`;
        await insertReleaseItem(ctx, BASE, contentKey, index);
        await insertPublicHead(ctx, BASE, contentKey, index, "search body");
      }
    });

    await expect(
      t.mutation((ctx) => runConvexProgram(syncSearch(ctx, BASE.releaseId)))
    ).resolves.toEqual({ done: false, nextIndex: 7, processed: 8 });
    await expect(
      t.mutation((ctx) => runConvexProgram(syncSearch(ctx, BASE.releaseId)))
    ).resolves.toEqual({ done: true, nextIndex: 7, processed: 0 });
    const stored = await t.run(async (ctx) => ({
      rows: await ctx.db.query("contentIndex").take(10),
      state: await ctx.db.query("contentState").unique(),
    }));
    expect(stored.rows).toHaveLength(8);
    expect(stored.state).toMatchObject({
      searchManifestHash: BASE.manifestHash,
      searchReleaseId: BASE.releaseId,
      searchSequence: BASE.sequence,
    });
  });

  it("continues search models larger than one transaction page", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      await insertCompletedRelease(ctx, BASE, 9);
      await insertTestState(ctx, { active: BASE, nextSequence: 2 });
      for (let index = 0; index < 9; index += 1) {
        const contentKey = `test:sync-${index}`;
        await insertReleaseItem(ctx, BASE, contentKey, index);
        await insertPublicHead(ctx, BASE, contentKey, index, "search body");
      }
    });

    await expect(
      t.mutation((ctx) => runConvexProgram(syncSearch(ctx, BASE.releaseId)))
    ).resolves.toEqual({ done: false, nextIndex: 7, processed: 8 });
    await expect(
      t.mutation((ctx) => runConvexProgram(syncSearch(ctx, BASE.releaseId)))
    ).resolves.toEqual({ done: true, nextIndex: 8, processed: 1 });
    await expect(
      t.run((ctx) => ctx.db.query("contentIndex").take(10))
    ).resolves.toHaveLength(9);
  });

  it("replaces, removes, and idempotently replays changed active entries", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      await insertCompletedRelease(ctx, BASE, 3);
      await insertTestState(ctx, { active: BASE, nextSequence: 3 });
      for (let index = 0; index < 3; index += 1) {
        const contentKey = `test:change-${index}`;
        await insertReleaseItem(ctx, BASE, contentKey, index);
        await insertPublicHead(ctx, BASE, contentKey, index, "old body");
      }
    });
    await t.mutation((ctx) =>
      runConvexProgram(syncSearch(ctx, BASE.releaseId))
    );
    await t.mutation(async (ctx) => {
      await insertCompletedRelease(ctx, NEXT, 3, BASE);
      for (let index = 0; index < 3; index += 1) {
        await insertReleaseItem(ctx, NEXT, `test:change-${index}`, index);
      }
      await insertPublicHead(ctx, NEXT, "test:change-0", 0, "new body");
      await ctx.db.insert("contentHeads", {
        contentKey: "test:change-1",
        family: "material",
        index: 1,
        locale: "en",
        operation: "delete",
        releaseId: NEXT.releaseId,
        sequence: NEXT.sequence,
      });
      await insertRuntimeVersion(ctx, "authenticated", "test:change-2", {
        headReleaseId: NEXT.releaseId,
        headSequence: NEXT.sequence,
        projectionJson: testProjectionJson({
          contentKey: "test:change-2",
          publicPath: "test/sync-2",
        }),
        publicPath: "test/sync-2",
      });
      await selectActiveRelease(ctx, NEXT);
    });

    await expect(
      t.mutation((ctx) => runConvexProgram(syncSearch(ctx, NEXT.releaseId)))
    ).resolves.toEqual({ done: true, nextIndex: 2, processed: 3 });
    await expect(
      t.mutation((ctx) => runConvexProgram(syncSearch(ctx, NEXT.releaseId)))
    ).resolves.toEqual({ done: true, nextIndex: 2, processed: 0 });
    const rows = await t.run((ctx) => ctx.db.query("contentIndex").take(4));
    expect(rows).toMatchObject([
      {
        contentKey: "test:change-0",
        releaseId: NEXT.releaseId,
        text: expect.stringContaining("new body"),
      },
    ]);
  });
});
