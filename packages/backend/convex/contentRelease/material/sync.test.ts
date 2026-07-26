import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { syncMaterials } from "@repo/backend/convex/contentRelease/material/sync";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  FUNCTION_MATERIAL_KEY,
  FUNCTION_MATERIAL_PATH,
  FUNCTION_MATERIAL_SOURCE,
  FUNCTION_MATERIAL_V2_JSON,
  testProjectionJson,
} from "@repo/backend/test/content-material";
import { testTextHash } from "@repo/backend/test/content-release";

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
  insertRuntimeKey,
  insertRuntimeVersion,
} from "@repo/backend/test/runtime-head";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

const BASE = {
  manifestHash: `sha256:${"8".repeat(64)}`,
  releaseId: "release-material-sync-base",
  sequence: 1,
} satisfies TestIdentity;
const NEXT = {
  manifestHash: `sha256:${"9".repeat(64)}`,
  releaseId: "release-material-sync-next",
  sequence: 2,
} satisfies TestIdentity;
const PRIOR = {
  manifestHash: `sha256:${"7".repeat(64)}`,
  releaseId: "release-material-sync-prior",
  sequence: 0,
} satisfies TestIdentity;

/** Inserts one active public material version and its changed release item. */
async function insertMaterial(
  ctx: MutationCtx,
  identity: TestIdentity,
  index: number,
  options?: {
    readonly changed?: boolean;
    readonly title?: string;
  }
) {
  const contentKey = `test:head-${index}`;
  const publicPath = `test/head-${index}`;
  const projectionJson = testProjectionJson({
    contentKey,
    index,
    publicPath,
    title: options?.title,
  });
  if (options?.changed !== false) {
    await insertReleaseItem(ctx, identity, contentKey, index);
  }
  const key = await ctx.db
    .query("contentKeys")
    .withIndex("by_contentKey_and_locale", (query) =>
      query.eq("contentKey", contentKey).eq("locale", "en")
    )
    .unique();
  if (!key) {
    await insertRuntimeKey(ctx, contentKey, {
      headSequence: identity.sequence,
      projectionJson,
    });
  }
  await insertRuntimeVersion(ctx, "public", contentKey, {
    headReleaseId: identity.releaseId,
    headSequence: identity.sequence,
    projectionJson,
    publicPath,
  });
  await insertRuntimeBinding(ctx, contentKey, {
    bindingReleaseId: identity.releaseId,
    bindingSequence: identity.sequence,
    publicPath,
  });
}

describe("contentRelease/material/sync", () => {
  it("builds the first complete model without relying on release deltas", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      await insertCompletedRelease(ctx, BASE, 0);
      await insertTestState(ctx, { active: BASE, nextSequence: 2 });
      await insertMaterial(ctx, BASE, 0, { changed: false });
    });

    await expect(
      t.mutation((ctx) => runConvexProgram(syncMaterials(ctx, BASE.releaseId)))
    ).resolves.toEqual({ done: true, nextIndex: -1, processed: 1 });
    await expect(
      t.run((ctx) => ctx.db.query("materialCatalog").unique())
    ).resolves.toMatchObject({ contentKey: "test:head-0" });
  });

  it("publishes a material model across bounded durable pages", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      await insertCompletedRelease(ctx, BASE, 9);
      await insertTestState(ctx, { active: BASE, nextSequence: 2 });
      for (let index = 0; index < 9; index += 1) {
        await insertMaterial(ctx, BASE, index);
      }
    });

    await expect(
      t.mutation((ctx) => runConvexProgram(syncMaterials(ctx, BASE.releaseId)))
    ).resolves.toEqual({ done: false, nextIndex: -1, processed: 8 });
    await expect(
      t.mutation((ctx) => runConvexProgram(syncMaterials(ctx, BASE.releaseId)))
    ).resolves.toEqual({ done: true, nextIndex: 8, processed: 1 });
    await expect(
      t.mutation((ctx) => runConvexProgram(syncMaterials(ctx, BASE.releaseId)))
    ).resolves.toEqual({ done: true, nextIndex: 8, processed: 0 });

    const stored = await t.run(async (ctx) => ({
      rows: await ctx.db.query("materialCatalog").take(10),
      state: await ctx.db.query("contentState").unique(),
    }));
    expect(stored.rows).toHaveLength(9);
    expect(stored.state).toMatchObject({
      materialManifestHash: BASE.manifestHash,
      materialReleaseId: BASE.releaseId,
      materialSequence: BASE.sequence,
    });
  });

  it("replaces and deletes material identities after activation", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      await insertCompletedRelease(ctx, BASE, 2);
      await insertTestState(ctx, { active: BASE, nextSequence: 3 });
      await insertMaterial(ctx, BASE, 0);
      await insertMaterial(ctx, BASE, 1);
    });
    await t.mutation((ctx) =>
      runConvexProgram(syncMaterials(ctx, BASE.releaseId))
    );
    await t.mutation(async (ctx) => {
      await insertCompletedRelease(ctx, NEXT, 2, BASE);
      await insertMaterial(ctx, NEXT, 0, { title: "Updated Material" });
      await insertReleaseItem(ctx, NEXT, "test:head-1", 1);
      await ctx.db.insert("contentHeads", {
        contentKey: "test:head-1",
        family: "material",
        index: 1,
        locale: "en",
        operation: "delete",
        releaseId: NEXT.releaseId,
        sequence: NEXT.sequence,
      });
      await selectActiveRelease(ctx, NEXT);
    });

    await expect(
      t.mutation((ctx) => runConvexProgram(syncMaterials(ctx, NEXT.releaseId)))
    ).resolves.toEqual({ done: true, nextIndex: 1, processed: 2 });
    await expect(
      t.run((ctx) => ctx.db.query("materialCatalog").take(3))
    ).resolves.toMatchObject([
      {
        contentKey: "test:head-0",
        projectionHash: testTextHash(
          testProjectionJson({
            contentKey: "test:head-0",
            publicPath: "test/head-0",
            title: "Updated Material",
          })
        ),
        projectionJson: testProjectionJson({
          contentKey: "test:head-0",
          publicPath: "test/head-0",
          title: "Updated Material",
        }),
      },
    ]);
  });

  it("rejects one non-contiguous material release page", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      await insertCompletedRelease(ctx, BASE, 1);
      await insertTestState(ctx, {
        active: BASE,
        material: PRIOR,
        nextSequence: 2,
      });
      await insertReleaseItem(ctx, BASE, "test:head-0", 1);
    });
    await expect(
      t.mutation((ctx) => runConvexProgram(syncMaterials(ctx, BASE.releaseId)))
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });
  });

  it("rejects partial material ownership before baseline work", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      await insertCompletedRelease(ctx, BASE, 0);
      await insertTestState(ctx, { active: BASE, nextSequence: 2 });
      const state = await ctx.db.query("contentState").unique();
      if (!state) {
        throw new Error("Expected content synchronization state.");
      }
      await ctx.db.patch("contentState", state._id, {
        materialReleaseId: BASE.releaseId,
      });
    });
    await expect(
      t.mutation((ctx) => runConvexProgram(syncMaterials(ctx, BASE.releaseId)))
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });
  });

  it("rejects an incomplete material release page", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      await insertCompletedRelease(ctx, BASE, 2);
      await insertTestState(ctx, {
        active: BASE,
        material: PRIOR,
        nextSequence: 2,
      });
      await insertReleaseItem(ctx, BASE, "test:head-0", 0);
    });
    await expect(
      t.mutation((ctx) => runConvexProgram(syncMaterials(ctx, BASE.releaseId)))
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });
  });

  it("rebuilds the exact retained v2 material during forward rollback", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      await insertCompletedRelease(ctx, BASE, 1);
      await insertTestState(ctx, { active: BASE, nextSequence: 2 });
      await insertReleaseItem(ctx, BASE, FUNCTION_MATERIAL_KEY, 0);
      await insertRuntimeKey(ctx, FUNCTION_MATERIAL_KEY, {
        headSequence: BASE.sequence,
        projectionJson: FUNCTION_MATERIAL_V2_JSON,
      });
      await insertRuntimeVersion(ctx, "public", FUNCTION_MATERIAL_KEY, {
        headReleaseId: BASE.releaseId,
        headSequence: BASE.sequence,
        projectionJson: FUNCTION_MATERIAL_V2_JSON,
        publicPath: FUNCTION_MATERIAL_PATH,
        rendererDomain: "mathematics",
        sourcePath: FUNCTION_MATERIAL_SOURCE,
      });
      await insertRuntimeBinding(ctx, FUNCTION_MATERIAL_KEY, {
        bindingReleaseId: BASE.releaseId,
        bindingSequence: BASE.sequence,
        publicPath: FUNCTION_MATERIAL_PATH,
      });
    });

    await expect(
      t.mutation((ctx) => runConvexProgram(syncMaterials(ctx, BASE.releaseId)))
    ).resolves.toEqual({ done: true, nextIndex: 0, processed: 1 });
    const [row] = await t.run((ctx) => ctx.db.query("materialCatalog").take(1));
    expect(row).toMatchObject({
      contentKey: FUNCTION_MATERIAL_KEY,
      publicPath: FUNCTION_MATERIAL_PATH,
    });
    expect(JSON.parse(row?.projectionJson ?? "{}")).not.toHaveProperty(
      "topicTitle"
    );
  });
});
