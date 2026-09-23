import { assert, describe, expect, it } from "@effect/vitest";
import { internal } from "@repo/backend/convex/_generated/api";
import {
  ARTIFACT_PROOF_PAGE_BYTES,
  PROOF_PAGE_LIMIT,
  PROOF_QUERY_HEADROOM,
} from "@repo/backend/convex/contentRelease/spec";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  insertProofItem,
  insertProofRoute,
} from "@repo/backend/test/content/proof";
import {
  TEST_MANIFEST_HASH,
  TEST_RELEASE_ID,
  testDeleteJson,
} from "@repo/backend/test/content/release";
import { insertTestRelease } from "@repo/backend/test/content/stage";
import {
  beginFixture,
  stageUpsertFixture,
} from "@repo/backend/test/content/verify";
import { convexTest } from "convex-test";
import { Struct } from "effect";

const proofState = internal.contentRelease.proof.read.state;
const proofPage = internal.contentRelease.proof.read.page;
const routePage = internal.contentRelease.proof.read.routePage;
const artifactPlan = internal.contentRelease.proof.read.artifactPlan;
const artifactBatch = internal.contentRelease.proof.read.artifactBatch;

describe("contentRelease/proof/read", () => {
  it("returns immutable staging state bound to one manifest", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation((ctx) =>
      insertTestRelease(ctx, {
        itemCount: 2,
        stagedArtifacts: 1,
        stagedItems: 2,
        stagedProjections: 1,
        stagedRoutes: 1,
        stagedUpserts: 1,
        status: "verifying",
      })
    );

    await expect(
      t.query(proofState, {
        manifestHash: TEST_MANIFEST_HASH,
        releaseId: TEST_RELEASE_ID,
      })
    ).resolves.toMatchObject({
      checkedIndex: -1,
      stagedArtifacts: 1,
      stagedItems: 2,
      stagedProjections: 1,
      stagedRoutes: 1,
      stagedUpserts: 1,
      status: "verifying",
    });
    await expect(
      t.query(proofState, {
        manifestHash: `sha256:${"f".repeat(64)}`,
        releaseId: TEST_RELEASE_ID,
      })
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_CONFLICT" } });

    await t.mutation(async (ctx) => {
      const release = await ctx.db.query("contentReleases").unique();
      if (!release) {
        throw new Error("Expected proof release.");
      }
      await ctx.db.patch("contentReleases", release._id, {
        status: "verified",
      });
    });
    await expect(
      t.query(proofState, {
        manifestHash: TEST_MANIFEST_HASH,
        releaseId: TEST_RELEASE_ID,
      })
    ).resolves.toMatchObject({ status: "verified" });
  });

  it("plans and reads exact publisher-owned artifact batches", async () => {
    const t = convexTest(schema, convexModules);
    await stageUpsertFixture(t);
    await beginFixture(t);

    await expect(
      t.query(artifactPlan, {
        manifestHash: TEST_MANIFEST_HASH,
        releaseId: TEST_RELEASE_ID,
      })
    ).resolves.toEqual({ batchCount: 1, stagedArtifacts: 1 });
    await expect(
      t.query(artifactBatch, { batchIndex: 0, releaseId: TEST_RELEASE_ID })
    ).resolves.toMatchObject({
      batchIndex: 0,
      rows: [{ index: 0 }],
    });
    await expect(
      t.query(artifactBatch, { batchIndex: 1, releaseId: TEST_RELEASE_ID })
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });
  });

  it("rejects non-verifiable state and invalid cursors", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      await insertTestRelease(ctx);
      const release = await ctx.db.query("contentReleases").unique();
      if (!release) {
        throw new Error("Expected release fixture.");
      }
      await ctx.db.patch("contentReleases", release._id, { abortingAt: 1 });
    });

    await expect(
      t.query(proofState, {
        manifestHash: TEST_MANIFEST_HASH,
        releaseId: TEST_RELEASE_ID,
      })
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_STATE" } });
    await expect(
      t.query(proofPage, {
        afterIndex: -2,
        releaseId: TEST_RELEASE_ID,
      })
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_INTEGRITY" } });
    await expect(
      t.query(routePage, {
        afterIndex: -2,
        releaseId: TEST_RELEASE_ID,
      })
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_INTEGRITY" } });
    await expect(
      t.query(proofPage, {
        afterIndex: -1,
        releaseId: TEST_RELEASE_ID,
      })
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_STATE" } });
    await expect(
      t.query(routePage, {
        afterIndex: -1,
        releaseId: TEST_RELEASE_ID,
      })
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_STATE" } });
  });

  it("pages item and route streams without delete projections", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      await insertTestRelease(ctx, {
        deleteCount: 1,
        itemCount: 2,
        projectionCount: 1,
        routeCount: 2,
        stagedArtifacts: 1,
        stagedDeletes: 1,
        stagedItems: 2,
        stagedProjections: 1,
        stagedRoutes: 2,
        stagedUpserts: 1,
        status: "verifying",
        upsertCount: 1,
      });
      await insertProofItem(ctx, 0);
      await insertProofItem(ctx, 1, "delete");
      await insertProofRoute(ctx, 0);
      await insertProofRoute(ctx, 1);
    });

    const items = await t.query(proofPage, {
      afterIndex: -1,
      releaseId: TEST_RELEASE_ID,
    });
    const routes = await t.query(routePage, {
      afterIndex: -1,
      releaseId: TEST_RELEASE_ID,
    });

    expect(items).toMatchObject({ done: true, nextIndex: 1 });
    expect(items.rows).toHaveLength(2);
    expect(items.rows[0]?.projectionJson).toBeDefined();
    expect(items.rows[1]?.projectionJson).toBeUndefined();
    expect(routes).toMatchObject({ done: true, nextIndex: 1 });
    expect(routes.rows).toHaveLength(2);
  });

  it("caps proof streams by record and response size", async () => {
    const records = convexTest(schema, convexModules);
    const recordCount = PROOF_PAGE_LIMIT + 1;
    await records.mutation(async (ctx) => {
      await insertTestRelease(ctx, {
        itemCount: recordCount,
        projectionCount: recordCount,
        status: "verifying",
      });
      for (let index = 0; index < recordCount; index += 1) {
        await insertProofItem(ctx, index);
        await insertProofRoute(ctx, index);
      }
    });
    await expect(
      records.query(proofPage, {
        afterIndex: -1,
        releaseId: TEST_RELEASE_ID,
      })
    ).resolves.toMatchObject({
      done: false,
      nextIndex: PROOF_PAGE_LIMIT - 1,
    });
    await expect(
      records.query(routePage, {
        afterIndex: -1,
        releaseId: TEST_RELEASE_ID,
      })
    ).resolves.toMatchObject({
      done: false,
      nextIndex: PROOF_PAGE_LIMIT - 1,
    });

    const bytes = convexTest(schema, convexModules);
    await bytes.mutation(async (ctx) => {
      await insertTestRelease(ctx, {
        itemCount: 6,
        projectionCount: 6,
        status: "verifying",
      });
      for (let index = 0; index < 6; index += 1) {
        await insertProofItem(ctx, index);
        const row = await ctx.db
          .query("contentItems")
          .withIndex("by_releaseId_and_index", (query) =>
            query.eq("releaseId", TEST_RELEASE_ID).eq("index", index)
          )
          .unique();
        if (!row) {
          throw new Error(`Expected proof row ${index}.`);
        }
        await ctx.db.patch("contentItems", row._id, {
          projectionJson: "x".repeat(900_000),
        });
      }
    });
    const page = await bytes.query(proofPage, {
      afterIndex: -1,
      releaseId: TEST_RELEASE_ID,
    });
    expect(page.done).toBe(false);
    expect(page.rows.length).toBeGreaterThan(0);
    expect(page.rows.length).toBeLessThan(6);
  });

  it("rejects a first proof row that cannot advance the bounded page", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      await insertTestRelease(ctx, {
        itemCount: 1,
        projectionCount: 1,
        status: "verifying",
      });
      await insertProofItem(ctx, 0);
      const row = await ctx.db.query("contentItems").unique();
      if (!row) {
        throw new Error("Expected oversized proof row.");
      }
      await ctx.db.patch("contentItems", row._id, {
        projectionJson: "x".repeat(4_200_000),
      });
    });

    await expect(
      t.query(proofPage, {
        afterIndex: -1,
        releaseId: TEST_RELEASE_ID,
      })
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_LIMIT" },
    });
  });
});

it.each([
  "not-ready",
  "wrong-hash",
  "deleted",
  "missing",
  "oversized",
] as const)("rejects corrupt artifact evidence: %s", async (condition) => {
  const t = convexTest(schema, convexModules);
  await stageUpsertFixture(t);
  await beginFixture(t);
  await t.mutation(async (ctx) => {
    const row = await ctx.db.query("contentItems").unique();
    const artifact = await ctx.db.query("contentArtifacts").unique();
    assert(row && artifact);
    if (condition === "not-ready") {
      await ctx.db.patch("contentItems", row._id, { artifactReady: false });
    }
    if (condition === "wrong-hash") {
      await ctx.db.patch("contentItems", row._id, {
        artifactHash: `sha256:${"f".repeat(64)}`,
      });
    }
    if (condition === "deleted") {
      await ctx.db.patch("contentItems", row._id, {
        itemJson: testDeleteJson({ contentKey: row.contentKey }),
      });
    }
    if (condition === "missing") {
      await ctx.db.delete("contentArtifacts", artifact._id);
    }
    if (condition === "oversized") {
      await ctx.db.patch("contentArtifacts", artifact._id, {
        artifactJson: "x".repeat(ARTIFACT_PROOF_PAGE_BYTES),
      });
    }
  });
  await expect(
    t.query(artifactBatch, { releaseId: TEST_RELEASE_ID, batchIndex: 0 })
  ).rejects.toMatchObject({
    data: {
      code: {
        missing: "CONTENT_RELEASE_MISSING",
        oversized: "CONTENT_RELEASE_LIMIT",
        "wrong-hash": "CONTENT_RELEASE_INTEGRITY",
        deleted: "CONTENT_RELEASE_INTEGRITY",
        "not-ready": "CONTENT_RELEASE_INTEGRITY",
      }[condition],
    },
  });
});

it.each(["stray", "missing", "fractional", "overflow"] as const)(
  "rejects inconsistent artifact directories: %s",
  async (condition) => {
    const t = convexTest(schema, convexModules);
    await stageUpsertFixture(t);
    await beginFixture(t);
    await t.mutation(async (ctx) => {
      const release = await ctx.db.query("contentReleases").unique();
      const row = await ctx.db.query("contentItems").unique();
      assert(release && row);
      if (condition === "stray") {
        await ctx.db.patch("contentReleases", release._id, {
          stagedArtifacts: 0,
        });
      } else {
        await ctx.db.patch("contentItems", row._id, {
          artifactBatchIndex: {
            missing: undefined,
            fractional: 0.5,
            overflow: 1,
          }[condition],
        });
      }
    });
    await expect(
      t.query(artifactPlan, {
        releaseId: TEST_RELEASE_ID,
        manifestHash: TEST_MANIFEST_HASH,
      })
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_INTEGRITY" } });
  }
);

it.each(["aborting", "staging", "verified"] as const)(
  "fences artifact and item proof readers by lifecycle: %s",
  async (condition) => {
    const t = convexTest(schema, convexModules);
    await stageUpsertFixture(t);
    await beginFixture(t);
    await t.mutation(async (ctx) => {
      const release = await ctx.db.query("contentReleases").unique();
      assert(release);
      await ctx.db.patch(
        "contentReleases",
        release._id,
        condition === "aborting" ? { abortingAt: 1 } : { status: condition }
      );
    });
    for (const batchIndex of [-1, 0.5]) {
      await expect(
        t.query(artifactBatch, { releaseId: TEST_RELEASE_ID, batchIndex })
      ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_INTEGRITY" } });
    }
    const batch = t.query(artifactBatch, {
      releaseId: TEST_RELEASE_ID,
      batchIndex: 0,
    });
    const page = t.query(proofPage, {
      releaseId: TEST_RELEASE_ID,
      afterIndex: -1,
    });
    if (condition === "verified") {
      expect((await batch).rows).toHaveLength(1);
      expect((await page).rows).toHaveLength(1);
    } else {
      await expect(batch).rejects.toMatchObject({
        data: { code: "CONTENT_RELEASE_STATE" },
      });
      await expect(page).rejects.toMatchObject({
        data: { code: "CONTENT_RELEASE_STATE" },
      });
    }
  }
);

it("yields item proof before the transaction query reserve is exhausted", async () => {
  const t = convexTest({
    schema,
    modules: convexModules,
    transactionLimits: { databaseQueries: PROOF_QUERY_HEADROOM + 1 },
  });
  await t.mutation(async (ctx) => {
    await insertTestRelease(ctx, {
      itemCount: 2,
      projectionCount: 2,
      status: "verifying",
    });
    await insertProofItem(ctx, 0);
    await insertProofItem(ctx, 1);
  });
  const first = await t.query(proofPage, {
    releaseId: TEST_RELEASE_ID,
    afterIndex: -1,
  });
  expect(first).toMatchObject({ done: false, nextIndex: 0 });
  expect(first.rows).toHaveLength(1);
  const second = await t.query(proofPage, {
    releaseId: TEST_RELEASE_ID,
    afterIndex: first.nextIndex,
  });
  expect(second).toMatchObject({ done: true, nextIndex: 1 });
});

it("returns artifact rows in signed item order inside the publisher batch", async () => {
  const t = convexTest(schema, convexModules);
  await stageUpsertFixture(t);
  await beginFixture(t);
  await t.mutation(async (ctx) => {
    const row = await ctx.db.query("contentItems").unique();
    assert(row);
    await ctx.db.patch("contentItems", row._id, { index: 1 });
    await ctx.db.insert("contentItems", {
      ...Struct.omit(row, ["_id", "_creationTime"]),
      index: 0,
    });
  });
  const batch = await t.query(artifactBatch, {
    releaseId: TEST_RELEASE_ID,
    batchIndex: 0,
  });
  expect(batch.rows.map((row) => row.index)).toEqual([0, 1]);
});
