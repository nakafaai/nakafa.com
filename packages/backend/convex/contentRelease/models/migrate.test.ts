import { describe, expect, it } from "@effect/vitest";
import { internal } from "@repo/backend/convex/_generated/api";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { migrateModelPage } from "@repo/backend/convex/contentRelease/models/migration/page";
import { requirePreMigrationModels } from "@repo/backend/convex/contentRelease/models/migration/state";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  insertTestState,
  type TestIdentity,
} from "@repo/backend/test/content/state";
import { convexTest } from "convex-test";

const ACTIVE = {
  manifestHash: `sha256:${"a".repeat(64)}`,
  releaseId: "release-model-migration-active",
  sequence: 1,
} satisfies TestIdentity;

const CHANGED = {
  manifestHash: `sha256:${"b".repeat(64)}`,
  releaseId: "release-model-migration-changed",
  sequence: 2,
} satisfies TestIdentity;

/** Inserts every model table plus one page boundary worth of article rows. */
async function seedModels(ctx: MutationCtx, slot?: "blue" | "green") {
  for (let index = 0; index < 70; index += 1) {
    await ctx.db.insert("articleCatalog", {
      appLocale: "en",
      assetId: `asset:article:${index}`,
      bucket: "aaa",
      category: "news",
      categoryTitle: "News",
      contentKey: `articles/news/${index}`,
      datePublished: "2026-08-29",
      projectionHash: ACTIVE.manifestHash,
      publicPath: `articles/news/${index}`,
      releaseId: ACTIVE.releaseId,
      rendererDomain: "politics",
      sequence: ACTIVE.sequence,
      ...(slot === undefined ? {} : { slot }),
    });
  }
  await ctx.db.insert("articleCategories", {
    appLocale: "en",
    bucket: "aaa",
    category: "news",
    contentKey: "articles/news/0",
    projectionHash: ACTIVE.manifestHash,
    releaseId: ACTIVE.releaseId,
    rendererDomain: "politics",
    sequence: ACTIVE.sequence,
    ...(slot === undefined ? {} : { slot }),
    title: "News",
  });
  await ctx.db.insert("articleBuckets", {
    appLocale: "en",
    articleCount: 70,
    bucket: "aaa",
    categoryCount: 1,
    ...(slot === undefined ? {} : { slot }),
  });
  await ctx.db.insert("materialCatalog", {
    appLocale: "en",
    assetId: "asset:material:1",
    bucket: "bbb",
    contentKey: "materials/math/algebra/lesson",
    datePublished: "2026-08-29",
    materialKey: "materials/math/algebra",
    order: 1,
    parentPath: "materials/math/algebra",
    projectionHash: ACTIVE.manifestHash,
    projectionJson: "{}",
    publicPath: "materials/math/algebra/lesson",
    releaseId: ACTIVE.releaseId,
    rendererDomain: "mathematics",
    sequence: ACTIVE.sequence,
    ...(slot === undefined ? {} : { slot }),
    sourcePath: "materials/math/algebra/lesson.mdx",
    topicAssetId: "asset:material:topic",
  });
  await ctx.db.insert("materialBuckets", {
    appLocale: "en",
    bucket: "bbb",
    count: 1,
    ...(slot === undefined ? {} : { slot }),
  });
  await ctx.db.insert("contentIndex", {
    appLocale: "en",
    contentKey: "articles/news/0",
    family: "article",
    projectionHash: ACTIVE.manifestHash,
    publicPath: "articles/news/0",
    releaseId: ACTIVE.releaseId,
    sequence: ACTIVE.sequence,
    ...(slot === undefined ? {} : { slot }),
    text: "News",
  });
}

/** Inserts the exact converged active state required by the migration. */
function seedState(ctx: MutationCtx, candidate?: TestIdentity) {
  return insertTestState(ctx, {
    active: ACTIVE,
    article: ACTIVE,
    candidate,
    material: ACTIVE,
    nextSequence: candidate ? candidate.sequence + 1 : 2,
    search: ACTIVE,
  });
}

describe("contentRelease/models/migrate", () => {
  it("backfills, verifies, publishes, and accepts one resumable slot cycle", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      await seedState(ctx);
      await seedModels(ctx);
    });

    const first = await t.mutation((ctx) =>
      runConvexProgram(migrateModelPage(ctx))
    );
    expect(first).toMatchObject({
      complete: false,
      phase: "backfill",
      table: "articleCatalog",
    });
    expect(first.scannedRows).toBeGreaterThan(0);
    await expect(
      t.mutation((ctx) => runConvexProgram(requirePreMigrationModels(ctx)))
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_STATE" },
    });
    await expect(
      t.run((ctx) => ctx.db.query("contentState").unique())
    ).resolves.not.toHaveProperty("articleSlot");

    const paused = await t.action(
      internal.contentRelease.models.migrate.run,
      {}
    );
    expect(paused).toMatchObject({ complete: false, phase: "verify" });
    const completed = await t.action(
      internal.contentRelease.models.migrate.run,
      {}
    );
    expect(completed).toEqual({
      complete: true,
      phase: "complete",
      scannedRows: 150,
      table: "contentReleases",
    });
    const stored = await t.run(async (ctx) => ({
      articles: await ctx.db.query("articleCatalog").collect(),
      migration: await ctx.db.query("contentModelMigrations").unique(),
      state: await ctx.db.query("contentState").unique(),
    }));
    expect(stored.articles).toHaveLength(70);
    expect(stored.articles.every(({ slot }) => slot === "blue")).toBe(true);
    expect(stored.migration).toMatchObject({ phase: "complete" });
    expect(stored.state).toMatchObject({
      articleSlot: "blue",
      materialSlot: "blue",
      searchSlot: "blue",
    });
    await expect(
      t.query(internal.contentRelease.models.migrate.status, {})
    ).resolves.toEqual(completed);
    await expect(
      t.mutation((ctx) => runConvexProgram(migrateModelPage(ctx)))
    ).resolves.toEqual(completed);

    await t.mutation(internal.contentRelease.models.migrate.accept, {});
    await expect(
      t.query(internal.contentRelease.models.migrate.status, {})
    ).resolves.toEqual({ phase: "absent" });
    await expect(
      t.mutation((ctx) => runConvexProgram(requirePreMigrationModels(ctx)))
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_STATE" },
    });
  });

  it("preserves rows already assigned to the initial buffer", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      await seedState(ctx);
      await seedModels(ctx, "blue");
    });

    await t.action(internal.contentRelease.models.migrate.run, {});
    await expect(
      t.action(internal.contentRelease.models.migrate.run, {})
    ).resolves.toMatchObject({ complete: true });
  });

  it("rejects migration while a candidate owns publication state", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      await seedState(ctx, CHANGED);
      await seedModels(ctx);
    });

    await expect(
      t.mutation((ctx) => runConvexProgram(migrateModelPage(ctx)))
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_STATE" },
    });
    await expect(
      t.run((ctx) => ctx.db.query("contentModelMigrations").collect())
    ).resolves.toEqual([]);
  });

  it("rejects a conflicting preexisting buffer", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      await seedState(ctx);
      await seedModels(ctx, "green");
    });

    await expect(
      t.mutation((ctx) => runConvexProgram(migrateModelPage(ctx)))
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });
  });

  it("rejects active identity drift between durable pages", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      await seedState(ctx);
      await seedModels(ctx);
    });
    await t.mutation((ctx) => runConvexProgram(migrateModelPage(ctx)));
    await t.mutation(async (ctx) => {
      const state = await ctx.db.query("contentState").unique();
      expect(state).not.toBeNull();
      if (state) {
        await ctx.db.patch("contentState", state._id, {
          activeManifestHash: CHANGED.manifestHash,
          activeReleaseId: CHANGED.releaseId,
          activeSequence: CHANGED.sequence,
          articleManifestHash: CHANGED.manifestHash,
          articleReleaseId: CHANGED.releaseId,
          articleSequence: CHANGED.sequence,
          materialManifestHash: CHANGED.manifestHash,
          materialReleaseId: CHANGED.releaseId,
          materialSequence: CHANGED.sequence,
          searchManifestHash: CHANGED.manifestHash,
          searchReleaseId: CHANGED.releaseId,
          searchSequence: CHANGED.sequence,
        });
      }
    });

    await expect(
      t.mutation((ctx) => runConvexProgram(migrateModelPage(ctx)))
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_STALE_BASE" },
    });
  });

  it("rejects verification drift and premature acceptance", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      await seedState(ctx);
      await seedModels(ctx);
    });
    await expect(
      t.mutation(internal.contentRelease.models.migrate.accept, {})
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_STATE" },
    });
    await t.mutation((ctx) => runConvexProgram(migrateModelPage(ctx)));
    await t.action(internal.contentRelease.models.migrate.run, {});
    await t.mutation(async (ctx) => {
      const category = await ctx.db.query("articleCategories").unique();
      expect(category).not.toBeNull();
      if (category) {
        await ctx.db.patch("articleCategories", category._id, {
          slot: "green",
        });
      }
    });

    await expect(
      t.action(internal.contentRelease.models.migrate.run, {})
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });
  });
});
