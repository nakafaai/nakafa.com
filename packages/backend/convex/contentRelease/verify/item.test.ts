import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { checkItem } from "@repo/backend/convex/contentRelease/verify/item";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { testArtifactJson } from "@repo/backend/test/content-artifact";
import {
  TEST_RELEASE_ID,
  testProjectionJson,
  testRollbackJson,
} from "@repo/backend/test/content-release";
import {
  TEST_ARTICLE_KEY,
  TEST_ARTICLE_SOURCE,
} from "@repo/backend/test/content-runtime";
import {
  beginFixture,
  stageDeleteFixture,
  stageUpsertFixture,
} from "@repo/backend/test/content-verify";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

/** Runs item verification against the only staged release item. */
async function verifyOnly(ctx: MutationCtx) {
  const row = await ctx.db.query("contentItems").unique();
  if (!row) {
    throw new Error("Expected verification item.");
  }
  return await runConvexProgram(checkItem(ctx, row));
}

describe("contentRelease/verify/item", () => {
  it("writes and idempotently replays one valid immutable upsert", async () => {
    const t = convexTest(schema, convexModules);
    await stageUpsertFixture(t);

    await expect(t.mutation(verifyOnly)).resolves.toBeNull();
    await expect(t.mutation(verifyOnly)).resolves.toBeNull();
    await expect(
      t.run((ctx) => ctx.db.query("contentHeads").unique())
    ).resolves.toMatchObject({
      contentKey: "test:head-0",
      operation: "upsert",
      releaseId: TEST_RELEASE_ID,
      sequence: 1,
    });
  });

  it("verifies an article upsert and preserves its family through deletion", async () => {
    const upsert = convexTest(schema, convexModules);
    await stageUpsertFixture(upsert, "article");
    await beginFixture(upsert);

    await expect(upsert.mutation(verifyOnly)).resolves.toBeNull();
    await expect(
      upsert.run((ctx) => ctx.db.query("contentHeads").unique())
    ).resolves.toMatchObject({
      contentKey: TEST_ARTICLE_KEY,
      family: "article",
      operation: "upsert",
      rendererDomain: "politics",
      sourcePath: TEST_ARTICLE_SOURCE,
    });

    const deletion = convexTest(schema, convexModules);
    await stageDeleteFixture(deletion, "article");
    const staged = await deletion.run((ctx) =>
      ctx.db.query("contentItems").unique()
    );
    expect(JSON.parse(staged?.rollbackJson ?? "{}")).toMatchObject({
      snapshot: {
        head: {
          contentKey: TEST_ARTICLE_KEY,
          family: "article",
          sourcePath: TEST_ARTICLE_SOURCE,
        },
        state: "article",
      },
    });
    await beginFixture(deletion);
    await expect(deletion.mutation(verifyOnly)).resolves.toBeNull();
    const heads = await deletion.run((ctx) =>
      ctx.db.query("contentHeads").take(3)
    );
    expect(heads.find(({ sequence }) => sequence === 2)).toMatchObject({
      contentKey: TEST_ARTICLE_KEY,
      family: "article",
      operation: "delete",
    });
  });

  it("writes and idempotently replays one body-free delete", async () => {
    const t = convexTest(schema, convexModules);
    await stageDeleteFixture(t);

    await expect(t.mutation(verifyOnly)).resolves.toBeNull();
    await expect(t.mutation(verifyOnly)).resolves.toBeNull();
    const heads = await t.run((ctx) => ctx.db.query("contentHeads").take(3));
    expect(heads.find(({ sequence }) => sequence === 2)).toMatchObject({
      contentKey: "test:deleted",
      operation: "delete",
      releaseId: TEST_RELEASE_ID,
    });
  });

  it("rejects missing artifact and projection bodies", async () => {
    const artifact = convexTest(schema, convexModules);
    await stageUpsertFixture(artifact);
    await artifact.mutation(async (ctx) => {
      const stored = await ctx.db.query("contentArtifacts").unique();
      if (!stored) {
        throw new Error("Expected staged artifact.");
      }
      await ctx.db.delete("contentArtifacts", stored._id);
    });
    await expect(artifact.mutation(verifyOnly)).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_MISSING" },
    });

    const projection = convexTest(schema, convexModules);
    await stageUpsertFixture(projection);
    await projection.mutation(async (ctx) => {
      const row = await ctx.db.query("contentItems").unique();
      if (!row) {
        throw new Error("Expected staged item.");
      }
      await ctx.db.patch("contentItems", row._id, {
        projectionJson: undefined,
        projectionReady: false,
      });
    });
    await expect(projection.mutation(verifyOnly)).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });
  });

  it("rejects mismatched artifacts, projections, and route ownership", async () => {
    const artifact = convexTest(schema, convexModules);
    await stageUpsertFixture(artifact);
    await artifact.mutation(async (ctx) => {
      const stored = await ctx.db.query("contentArtifacts").unique();
      if (!stored) {
        throw new Error("Expected staged artifact.");
      }
      await ctx.db.patch("contentArtifacts", stored._id, {
        artifactJson: testArtifactJson({ contentKey: "test:other" }),
      });
    });
    await expect(artifact.mutation(verifyOnly)).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });

    const projection = convexTest(schema, convexModules);
    await stageUpsertFixture(projection);
    await projection.mutation(async (ctx) => {
      const item = await ctx.db.query("contentItems").unique();
      if (!item) {
        throw new Error("Expected staged item.");
      }
      await ctx.db.patch("contentItems", item._id, {
        projectionJson: testProjectionJson({ contentKey: "test:other" }),
      });
    });
    await expect(projection.mutation(verifyOnly)).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });

    const route = convexTest(schema, convexModules);
    await stageUpsertFixture(route);
    await route.mutation(async (ctx) => {
      const binding = await ctx.db.query("contentBindings").unique();
      if (!binding) {
        throw new Error("Expected staged binding.");
      }
      await ctx.db.patch("contentBindings", binding._id, {
        contentKey: "test:other",
      });
    });
    await expect(route.mutation(verifyOnly)).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });
  });

  it("rejects rollback drift and delete rows with bodies", async () => {
    const rollback = convexTest(schema, convexModules);
    await stageUpsertFixture(rollback);
    await rollback.mutation(async (ctx) => {
      const row = await ctx.db.query("contentItems").unique();
      if (!row) {
        throw new Error("Expected staged item.");
      }
      await ctx.db.patch("contentItems", row._id, {
        rollbackJson: testRollbackJson({ contentKey: "test:other" }),
      });
    });
    await expect(rollback.mutation(verifyOnly)).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });

    const deleted = convexTest(schema, convexModules);
    await stageDeleteFixture(deleted);
    await deleted.mutation(async (ctx) => {
      const row = await ctx.db.query("contentItems").unique();
      if (!row) {
        throw new Error("Expected delete item.");
      }
      await ctx.db.patch("contentItems", row._id, { artifactReady: true });
    });
    await expect(deleted.mutation(verifyOnly)).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });
  });

  it("rejects conflicting immutable versions and oversized compact heads", async () => {
    const conflict = convexTest(schema, convexModules);
    await stageUpsertFixture(conflict);
    await conflict.mutation(async (ctx) => {
      await ctx.db.insert("contentHeads", {
        contentKey: "test:head-0",
        family: "material",
        index: 0,
        locale: "en",
        operation: "delete",
        releaseId: "release-conflict",
        sequence: 1,
      });
    });
    await expect(conflict.mutation(verifyOnly)).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_CONFLICT" },
    });

    const oversized = convexTest(schema, convexModules);
    await stageUpsertFixture(oversized);
    await oversized.mutation(async (ctx) => {
      const item = await ctx.db.query("contentItems").unique();
      if (!item) {
        throw new Error("Expected staged item.");
      }
      await ctx.db.patch("contentItems", item._id, {
        projectionJson: testProjectionJson({ title: "x".repeat(20_000) }),
      });
    });
    await expect(oversized.mutation(verifyOnly)).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_SIZE" },
    });
  });
});
