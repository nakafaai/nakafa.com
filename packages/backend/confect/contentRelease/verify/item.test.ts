import { RegisteredConvexFunction } from "@confect/server";
import { assert, describe, expect, it } from "@effect/vitest";
import confectSchema from "@repo/backend/confect/_generated/schema";
import { checkItem } from "@repo/backend/confect/contentRelease/verify/item";
import { convexModules } from "@repo/backend/confect/test.setup";
import { internal } from "@repo/backend/convex/_generated/api";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import schema from "@repo/backend/convex/schema";
import { testArtifactJson } from "@repo/backend/test/content/artifact";
import { testProjectionJson } from "@repo/backend/test/content/material";
import {
  TEST_PAGE_KEY,
  TEST_PAGE_PATH,
  TEST_PAGE_SOURCE,
} from "@repo/backend/test/content/page";
import { TEST_QUESTION_CONTENT_KEY } from "@repo/backend/test/content/question";
import {
  TEST_RELEASE_ID,
  testDeleteJson,
  testRollbackJson,
} from "@repo/backend/test/content/release";
import {
  TEST_ARTICLE_KEY,
  TEST_ARTICLE_SOURCE,
} from "@repo/backend/test/content/runtime";
import {
  beginFixture,
  stageDeleteFixture,
  stageUpsertFixture,
} from "@repo/backend/test/content/verify";
import { convexTest } from "convex-test";
import { Array as Arr, Effect, Option } from "effect";

/** Runs item verification against the only staged release item. */
function verifyOnly(ctx: MutationCtx) {
  return Effect.gen(function* () {
    const row = yield* Effect.promise(() =>
      ctx.db.query("contentItems").unique()
    );
    if (!row) {
      return yield* Effect.die(new Error("Expected verification item."));
    }
    return yield* checkItem(row).pipe(
      Effect.provide(RegisteredConvexFunction.mutationLayer(confectSchema, ctx))
    );
  });
}
describe("contentRelease/verify/item", () => {
  it.each(["identity", "version"] as const)(
    "rejects a staged delete with conflicting %s without advancing verification",
    async (conflict) => {
      const t = convexTest(schema, convexModules);
      await stageDeleteFixture(t);
      await beginFixture(t);
      await t.mutation(async (ctx) => {
        const item = await ctx.db.query("contentItems").unique();
        assert(item);
        if (conflict === "identity") {
          await ctx.db.patch(item._id, {
            itemJson: testDeleteJson({
              contentKey: "test:other",
            }),
          });
        } else {
          await ctx.db.insert("contentHeads", {
            artifactLocale: item.artifactLocale,
            contentKey: item.contentKey,
            family: "material",
            index: item.index,
            operation: "delete",
            releaseId: "release-conflict",
            sequence: item.sequence,
          });
        }
      });
      const before = await t.query((ctx) =>
        ctx.db.query("contentHeads").collect()
      );
      await expect(
        t.mutation(internal.contentRelease.verify.verifyItems, {
          afterIndex: -1,
          releaseId: TEST_RELEASE_ID,
        })
      ).rejects.toMatchObject({
        data: {
          code:
            conflict === "identity"
              ? "CONTENT_RELEASE_INTEGRITY"
              : "CONTENT_RELEASE_CONFLICT",
        },
      });
      expect(
        await t.query((ctx) => ctx.db.query("contentHeads").collect())
      ).toEqual(before);
      expect(
        await t.query((ctx) => ctx.db.query("contentReleases").unique())
      ).toMatchObject({
        checkedItems: 0,
        checkedIndex: -1,
      });
    }
  );
  it("rejects deletion while its content still owns a visible route", async () => {
    const t = convexTest(schema, convexModules);
    await stageDeleteFixture(t);
    await t.mutation(async (ctx) => {
      const bindings = await ctx.db.query("contentBindings").collect();
      const tombstone = Option.getOrUndefined(
        Arr.findFirst(bindings, (binding) => binding.sequence === 2)
      );
      const item = await ctx.db.query("contentItems").unique();
      assert(tombstone && item);
      await ctx.db.patch(tombstone._id, {
        operation: "bind",
        contentKey: item.contentKey,
      });
    });
    await expect(
      t.mutation((ctx) => Effect.runPromise(verifyOnly(ctx)))
    ).rejects.toMatchObject({
      code: "CONTENT_RELEASE_ROUTE",
    });
    const heads = await t.query((ctx) =>
      ctx.db.query("contentHeads").collect()
    );
    expect(Arr.every(heads, (head) => head.sequence !== 2)).toBe(true);
  });
  it("writes and idempotently replays one valid immutable upsert", async () => {
    const t = convexTest(schema, convexModules);
    await stageUpsertFixture(t);
    await expect(
      t.mutation((ctx) => Effect.runPromise(verifyOnly(ctx)))
    ).resolves.toBeNull();
    await expect(
      t.mutation((ctx) => Effect.runPromise(verifyOnly(ctx)))
    ).resolves.toBeNull();
    const stored = await t.run(async (ctx) => ({
      head: await ctx.db.query("contentHeads").unique(),
    }));
    expect(stored.head).toMatchObject({
      contentKey: "test:head-0",
      operation: "upsert",
      releaseId: TEST_RELEASE_ID,
      sequence: 1,
    });
    await expect(
      t.run((ctx) => ctx.db.query("contentIndex").take(1))
    ).resolves.toEqual([]);
  });
  it("verifies an article upsert and preserves its family through deletion", async () => {
    const upsert = convexTest(schema, convexModules);
    await stageUpsertFixture(upsert, "article");
    await beginFixture(upsert);
    await expect(
      upsert.mutation((ctx) => Effect.runPromise(verifyOnly(ctx)))
    ).resolves.toBeNull();
    const storedArticle = await upsert.run((ctx) =>
      ctx.db.query("contentHeads").unique()
    );
    expect(storedArticle).toMatchObject({
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
    await expect(
      deletion.mutation((ctx) => Effect.runPromise(verifyOnly(ctx)))
    ).resolves.toBeNull();
    const heads = await deletion.run((ctx) =>
      ctx.db.query("contentHeads").take(3)
    );
    expect(
      Option.getOrUndefined(
        Arr.findFirst(heads, ({ sequence }) => sequence === 2)
      )
    ).toMatchObject({
      contentKey: TEST_ARTICLE_KEY,
      family: "article",
      operation: "delete",
    });
  });
  it("verifies a page upsert and preserves its family through deletion", async () => {
    const upsert = convexTest(schema, convexModules);
    await stageUpsertFixture(upsert, "page");
    await beginFixture(upsert);
    await expect(
      upsert.mutation((ctx) => Effect.runPromise(verifyOnly(ctx)))
    ).resolves.toBeNull();
    const storedPage = await upsert.run((ctx) =>
      ctx.db.query("contentHeads").unique()
    );
    expect(storedPage).toMatchObject({
      contentKey: TEST_PAGE_KEY,
      family: "page",
      operation: "upsert",
      rendererDomain: "site",
      sourcePath: TEST_PAGE_SOURCE,
    });
    const deletion = convexTest(schema, convexModules);
    await stageDeleteFixture(deletion, "page");
    const staged = await deletion.run((ctx) =>
      ctx.db.query("contentItems").unique()
    );
    expect(JSON.parse(staged?.rollbackJson ?? "{}")).toMatchObject({
      snapshot: {
        head: {
          contentKey: TEST_PAGE_KEY,
          family: "page",
          publicPath: TEST_PAGE_PATH,
          sourcePath: TEST_PAGE_SOURCE,
        },
        state: "page",
      },
    });
    await beginFixture(deletion);
    await expect(
      deletion.mutation((ctx) => Effect.runPromise(verifyOnly(ctx)))
    ).resolves.toBeNull();
    const heads = await deletion.run((ctx) =>
      ctx.db.query("contentHeads").take(3)
    );
    expect(
      Option.getOrUndefined(
        Arr.findFirst(heads, ({ sequence }) => sequence === 2)
      )
    ).toMatchObject({
      contentKey: TEST_PAGE_KEY,
      family: "page",
      operation: "delete",
    });
  });
  it.each(["material", "question"] as const)(
    "writes and idempotently replays one body-free %s delete",
    async (family) => {
      const t = convexTest(schema, convexModules);
      await stageDeleteFixture(t, family);
      await expect(
        t.mutation((ctx) => Effect.runPromise(verifyOnly(ctx)))
      ).resolves.toBeNull();
      await expect(
        t.mutation((ctx) => Effect.runPromise(verifyOnly(ctx)))
      ).resolves.toBeNull();
      const heads = await t.run((ctx) => ctx.db.query("contentHeads").take(3));
      expect(
        Option.getOrUndefined(
          Arr.findFirst(heads, ({ sequence }) => sequence === 2)
        )
      ).toMatchObject({
        contentKey:
          family === "question" ? TEST_QUESTION_CONTENT_KEY : "test:deleted",
        family,
        operation: "delete",
        releaseId: TEST_RELEASE_ID,
      });
    }
  );
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
    await expect(
      artifact.mutation((ctx) => Effect.runPromise(verifyOnly(ctx)))
    ).rejects.toMatchObject({
      code: "CONTENT_RELEASE_MISSING",
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
    await expect(
      projection.mutation((ctx) => Effect.runPromise(verifyOnly(ctx)))
    ).rejects.toMatchObject({
      code: "CONTENT_RELEASE_INTEGRITY",
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
        artifactJson: testArtifactJson({
          contentKey: "test:other",
        }),
      });
    });
    await expect(
      artifact.mutation((ctx) => Effect.runPromise(verifyOnly(ctx)))
    ).rejects.toMatchObject({
      code: "CONTENT_RELEASE_INTEGRITY",
    });
    const projection = convexTest(schema, convexModules);
    await stageUpsertFixture(projection);
    await projection.mutation(async (ctx) => {
      const item = await ctx.db.query("contentItems").unique();
      if (!item) {
        throw new Error("Expected staged item.");
      }
      await ctx.db.patch("contentItems", item._id, {
        projectionJson: testProjectionJson({
          contentKey: "test:other",
        }),
      });
    });
    await expect(
      projection.mutation((ctx) => Effect.runPromise(verifyOnly(ctx)))
    ).rejects.toMatchObject({
      code: "CONTENT_RELEASE_INTEGRITY",
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
    await expect(
      route.mutation((ctx) => Effect.runPromise(verifyOnly(ctx)))
    ).rejects.toMatchObject({
      code: "CONTENT_RELEASE_INTEGRITY",
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
        rollbackJson: testRollbackJson({
          contentKey: "test:other",
        }),
      });
    });
    await expect(
      rollback.mutation((ctx) => Effect.runPromise(verifyOnly(ctx)))
    ).rejects.toMatchObject({
      code: "CONTENT_RELEASE_INTEGRITY",
    });
    await rollback.mutation(async (ctx) => {
      const row = await ctx.db.query("contentItems").unique();
      if (!row) {
        return expect.fail("Expected one staged item.");
      }
      await ctx.db.patch(row._id, {
        rollbackJson: testRollbackJson({
          index: 1,
        }),
      });
    });
    await expect(
      rollback.mutation((ctx) => Effect.runPromise(verifyOnly(ctx)))
    ).rejects.toMatchObject({
      code: "CONTENT_RELEASE_INTEGRITY",
      message: `Rollback evidence ${TEST_RELEASE_ID}/0 lost its identity.`,
    });
    const deleted = convexTest(schema, convexModules);
    await stageDeleteFixture(deleted);
    await deleted.mutation(async (ctx) => {
      const row = await ctx.db.query("contentItems").unique();
      if (!row) {
        return expect.fail("Expected one staged delete.");
      }
      await ctx.db.patch(row._id, {
        rollbackJson: testRollbackJson({
          contentKey: row.contentKey,
        }),
      });
    });
    await expect(
      deleted.mutation((ctx) => Effect.runPromise(verifyOnly(ctx)))
    ).rejects.toMatchObject({
      code: "CONTENT_RELEASE_INTEGRITY",
      message: `Rollback evidence ${TEST_RELEASE_ID}/0 differs from its base.`,
    });
    const withBody = convexTest(schema, convexModules);
    await stageDeleteFixture(withBody);
    await withBody.mutation(async (ctx) => {
      const row = await ctx.db.query("contentItems").unique();
      if (!row) {
        throw new Error("Expected delete item.");
      }
      await ctx.db.patch("contentItems", row._id, {
        artifactReady: true,
      });
    });
    await expect(
      withBody.mutation((ctx) => Effect.runPromise(verifyOnly(ctx)))
    ).rejects.toMatchObject({
      code: "CONTENT_RELEASE_INTEGRITY",
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
        artifactLocale: "en",
        operation: "delete",
        releaseId: "release-conflict",
        sequence: 1,
      });
    });
    await expect(
      conflict.mutation((ctx) => Effect.runPromise(verifyOnly(ctx)))
    ).rejects.toMatchObject({
      code: "CONTENT_RELEASE_CONFLICT",
    });
    const oversized = convexTest(schema, convexModules);
    await stageUpsertFixture(oversized);
    await oversized.mutation(async (ctx) => {
      const item = await ctx.db.query("contentItems").unique();
      if (!item) {
        throw new Error("Expected staged item.");
      }
      await ctx.db.patch("contentItems", item._id, {
        projectionJson: testProjectionJson({
          title: "x".repeat(20_000),
        }),
      });
    });
    await expect(
      oversized.mutation((ctx) => Effect.runPromise(verifyOnly(ctx)))
    ).rejects.toMatchObject({
      code: "CONTENT_RELEASE_SIZE",
    });
  });
});
