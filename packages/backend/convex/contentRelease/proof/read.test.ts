import { internal } from "@repo/backend/convex/_generated/api";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { testArtifactJson } from "@repo/backend/test/content-artifact";
import {
  insertProofItem,
  insertProofRoute,
} from "@repo/backend/test/content-proof";
import {
  insertTestRelease,
  TEST_MANIFEST_HASH,
  TEST_RELEASE_ID,
} from "@repo/backend/test/content-release";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

const proofState = internal.contentRelease.proof.read.state;
const proofPage = internal.contentRelease.proof.read.page;
const routePage = internal.contentRelease.proof.read.routePage;

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
        kind: "item",
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
        kind: "item",
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

  it("pages item, artifact, and route streams without delete bodies", async () => {
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
      kind: "item",
      releaseId: TEST_RELEASE_ID,
    });
    const artifacts = await t.query(proofPage, {
      afterIndex: -1,
      kind: "artifact",
      releaseId: TEST_RELEASE_ID,
    });
    const routes = await t.query(routePage, {
      afterIndex: -1,
      releaseId: TEST_RELEASE_ID,
    });

    expect(items).toMatchObject({ done: true, nextIndex: 1 });
    expect(items.rows).toHaveLength(2);
    expect(items.rows[0]?.projectionJson).toBeDefined();
    expect(artifacts.rows[0]?.artifactJson).toBeDefined();
    expect(artifacts.rows[1]?.artifactJson).toBeUndefined();
    expect(routes).toMatchObject({ done: true, nextIndex: 1 });
    expect(routes.rows).toHaveLength(2);
  });

  it("rejects an upsert whose immutable artifact disappeared", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      await insertTestRelease(ctx, { status: "verifying" });
      await insertProofItem(ctx, 0);
      const artifact = await ctx.db.query("contentArtifacts").unique();
      if (!artifact) {
        throw new Error("Expected proof artifact.");
      }
      await ctx.db.delete("contentArtifacts", artifact._id);
    });

    await expect(
      t.query(proofPage, {
        afterIndex: -1,
        kind: "artifact",
        releaseId: TEST_RELEASE_ID,
      })
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_MISSING" } });
  });

  it("caps proof streams by record and response size", async () => {
    const records = convexTest(schema, convexModules);
    await records.mutation(async (ctx) => {
      await insertTestRelease(ctx, {
        itemCount: 9,
        projectionCount: 9,
        status: "verifying",
      });
      for (let index = 0; index < 9; index += 1) {
        await insertProofItem(ctx, index);
        await insertProofRoute(ctx, index);
      }
    });
    await expect(
      records.query(proofPage, {
        afterIndex: -1,
        kind: "item",
        releaseId: TEST_RELEASE_ID,
      })
    ).resolves.toMatchObject({ done: false, nextIndex: 7 });
    await expect(
      records.query(routePage, {
        afterIndex: -1,
        releaseId: TEST_RELEASE_ID,
      })
    ).resolves.toMatchObject({ done: false, nextIndex: 7 });

    const bytes = convexTest(schema, convexModules);
    await bytes.mutation(async (ctx) => {
      await insertTestRelease(ctx, {
        itemCount: 6,
        projectionCount: 6,
        status: "verifying",
      });
      for (let index = 0; index < 6; index += 1) {
        await insertProofItem(
          ctx,
          index,
          "upsert",
          testArtifactJson({
            artifactHash: `sha256:${(index + 1)
              .toString(16)
              .padStart(64, "0")}`,
            compiledCode: "x".repeat(900_000),
            contentKey: `test:head-${index}`,
          })
        );
      }
    });
    const page = await bytes.query(proofPage, {
      afterIndex: -1,
      kind: "artifact",
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
      await insertProofItem(
        ctx,
        0,
        "upsert",
        testArtifactJson({ compiledCode: "x".repeat(4_200_000) })
      );
    });

    await expect(
      t.query(proofPage, {
        afterIndex: -1,
        kind: "artifact",
        releaseId: TEST_RELEASE_ID,
      })
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_LIMIT" },
    });
  });
});
