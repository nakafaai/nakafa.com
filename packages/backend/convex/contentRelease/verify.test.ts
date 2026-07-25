import { internal } from "@repo/backend/convex/_generated/api";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { testArtifactJson } from "@repo/backend/test/content-artifact";
import {
  TEST_RELEASE_ID,
  testProjectionJson,
  testRouteJson,
  testUpsertJson,
} from "@repo/backend/test/content-release";
import { insertTestRelease } from "@repo/backend/test/content-stage";
import {
  beginFixture,
  stageUpsertFixture,
} from "@repo/backend/test/content-verify";
import { convexTest, type TestConvex } from "convex-test";
import { describe, expect, it } from "vitest";

const stageItems = internal.contentRelease.items.stageItemBatch;
const stageArtifacts = internal.contentRelease.artifacts.stageArtifactBatch;
const stageProjections = internal.contentRelease.items.stageProjectionBatch;
const stageRoutes = internal.contentRelease.routes.stageRouteBatch;
const verifyItems = internal.contentRelease.verify.verifyItems;

/** Builds one unique complete technical change at an ordered index. */
function changeAt(index: number) {
  const contentKey = `test:head-${index}`;
  const publicPath = `test/head-${index}`;
  const artifactHash = `sha256:${(index + 1).toString(16).padStart(64, "0")}`;
  return {
    artifact: testArtifactJson({ artifactHash, contentKey }),
    item: testUpsertJson({ artifactHash, contentKey, index }),
    projection: testProjectionJson({ contentKey, index, publicPath }),
    route: testRouteJson({ contentKey, index, publicPath }),
  };
}

/** Stages nine complete changes across two bounded transport batches. */
async function stagePagedFixture(t: TestConvex<typeof schema>) {
  await t.mutation((ctx) =>
    insertTestRelease(ctx, {
      itemCount: 9,
      projectionCount: 9,
      routeCount: 9,
      upsertCount: 9,
    })
  );
  const changes = Array.from({ length: 9 }, (_, index) => changeAt(index));
  for (const [batchIndex, batch] of [
    changes.slice(0, 8),
    changes.slice(8),
  ].entries()) {
    await t.mutation(stageItems, {
      batchIndex,
      itemJson: batch.map(({ item }) => item),
      releaseId: TEST_RELEASE_ID,
    });
    await t.mutation(stageArtifacts, {
      artifactJson: batch.map(({ artifact }) => artifact),
      batchIndex,
      releaseId: TEST_RELEASE_ID,
    });
    await t.mutation(stageProjections, {
      batchIndex,
      projectionJson: batch.map(({ projection }) => projection),
      releaseId: TEST_RELEASE_ID,
    });
    await t.mutation(stageRoutes, {
      batchIndex,
      releaseId: TEST_RELEASE_ID,
      routeJson: batch.map(({ route }) => route),
    });
  }
  await beginFixture(t);
}

describe("contentRelease/verify", () => {
  it("freezes and verifies one complete release idempotently", async () => {
    const t = convexTest(schema, convexModules);
    await stageUpsertFixture(t);

    await expect(beginFixture(t)).resolves.toBe(-1);
    await expect(beginFixture(t)).resolves.toBe(-1);
    const checked = await t.mutation(verifyItems, {
      afterIndex: -1,
      releaseId: TEST_RELEASE_ID,
    });
    const release = await t.run((ctx) =>
      ctx.db.query("contentReleases").unique()
    );

    expect(checked).toEqual({ done: true, nextIndex: 0, processed: 1 });
    expect(release).toMatchObject({
      checkedIndex: 0,
      checkedItems: 1,
      status: "verifying",
    });
    await t.mutation(async (ctx) => {
      if (!release) {
        throw new Error("Expected verified release.");
      }
      await ctx.db.patch("contentReleases", release._id, {
        proofAt: 1,
        proofJson: "{}",
        status: "verified",
        verifiedAt: 1,
      });
    });
    await expect(
      t.mutation(verifyItems, {
        afterIndex: 0,
        releaseId: TEST_RELEASE_ID,
      })
    ).resolves.toEqual({ done: true, nextIndex: 0, processed: 0 });
    await expect(beginFixture(t)).resolves.toBe(0);
  });

  it("resumes verification across the bounded item page", async () => {
    const t = convexTest(schema, convexModules);
    await stagePagedFixture(t);

    const first = await t.mutation(verifyItems, {
      afterIndex: -1,
      releaseId: TEST_RELEASE_ID,
    });
    const second = await t.mutation(verifyItems, {
      afterIndex: first.nextIndex,
      releaseId: TEST_RELEASE_ID,
    });

    expect(first).toEqual({ done: false, nextIndex: 7, processed: 8 });
    expect(second).toEqual({ done: true, nextIndex: 8, processed: 1 });
  });

  it("rejects incomplete staging and invalid verification state", async () => {
    const incomplete = convexTest(schema, convexModules);
    await incomplete.mutation((ctx) => insertTestRelease(ctx));
    await expect(beginFixture(incomplete)).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_STATE" },
    });

    const invalid = convexTest(schema, convexModules);
    await invalid.mutation((ctx) =>
      insertTestRelease(ctx, { status: "verifying" })
    );
    await expect(
      invalid.mutation(verifyItems, {
        afterIndex: -2,
        releaseId: TEST_RELEASE_ID,
      })
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_STATE" } });
    await expect(
      invalid.mutation(verifyItems, {
        afterIndex: 0,
        releaseId: TEST_RELEASE_ID,
      })
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_CONFLICT" } });
  });

  it("rejects noncontiguous and incomplete item streams", async () => {
    const gap = convexTest(schema, convexModules);
    await stageUpsertFixture(gap);
    await beginFixture(gap);
    await gap.mutation(async (ctx) => {
      const row = await ctx.db.query("contentItems").unique();
      if (!row) {
        throw new Error("Expected staged item.");
      }
      await ctx.db.patch("contentItems", row._id, { index: 1 });
    });
    await expect(
      gap.mutation(verifyItems, {
        afterIndex: -1,
        releaseId: TEST_RELEASE_ID,
      })
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_INTEGRITY" } });

    const missing = convexTest(schema, convexModules);
    await missing.mutation(async (ctx) => {
      await insertTestRelease(ctx, {
        itemCount: 2,
        projectionCount: 2,
        routeCount: 2,
        stagedArtifacts: 2,
        stagedItems: 2,
        stagedProjections: 2,
        stagedRoutes: 2,
        stagedUpserts: 2,
        status: "verifying",
        upsertCount: 2,
      });
    });
    await expect(
      missing.mutation(verifyItems, {
        afterIndex: -1,
        releaseId: TEST_RELEASE_ID,
      })
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_INTEGRITY" } });
  });
});
