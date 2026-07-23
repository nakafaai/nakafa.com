import { internal } from "@repo/backend/convex/_generated/api";
import type schema from "@repo/backend/convex/schema";
import { testArtifactJson } from "@repo/backend/test/content-artifact";
import {
  insertTestRelease,
  TEST_RELEASE_ID,
  testDeleteJson,
  testProjectionJson,
  testRouteJson,
  testUpsertJson,
} from "@repo/backend/test/content-release";
import {
  insertRuntimeBinding,
  insertRuntimeVersion,
} from "@repo/backend/test/content-runtime";
import type { TestConvex } from "convex-test";

const stageItems = internal.contentRelease.items.stageItemBatch;
const stageArtifacts = internal.contentRelease.artifacts.stageArtifactBatch;
const stageProjections = internal.contentRelease.items.stageProjectionBatch;
const stageRoutes = internal.contentRelease.routes.stageRouteBatch;
const beginVerify = internal.contentRelease.verify.begin;

/** Stages one complete technical upsert through every real mutation. */
export async function stageUpsertFixture(t: TestConvex<typeof schema>) {
  await t.mutation((ctx) => insertTestRelease(ctx));
  await t.mutation(stageItems, {
    batchIndex: 0,
    itemJson: [testUpsertJson()],
    releaseId: TEST_RELEASE_ID,
  });
  await t.mutation(stageArtifacts, {
    artifactJson: [testArtifactJson()],
    batchIndex: 0,
    releaseId: TEST_RELEASE_ID,
  });
  await t.mutation(stageProjections, {
    batchIndex: 0,
    projectionJson: [testProjectionJson()],
    releaseId: TEST_RELEASE_ID,
  });
  await t.mutation(stageRoutes, {
    batchIndex: 0,
    releaseId: TEST_RELEASE_ID,
    routeJson: [testRouteJson()],
  });
}

/** Stages one complete delete plus its required route tombstone. */
export async function stageDeleteFixture(t: TestConvex<typeof schema>) {
  await t.mutation(async (ctx) => {
    await insertTestRelease(ctx, {
      deleteCount: 1,
      projectionCount: 0,
      routeCount: 1,
      sequence: 2,
      upsertCount: 0,
    });
    await insertRuntimeVersion(ctx, "public", "test:deleted", {
      headReleaseId: "release-base",
      headSequence: 1,
      publicPath: "test/deleted",
    });
    await insertRuntimeBinding(ctx, "test:deleted", {
      bindingReleaseId: "release-base",
      bindingSequence: 1,
      publicPath: "test/deleted",
    });
    const state = await ctx.db.query("contentState").unique();
    if (!state) {
      throw new Error("Expected publication state.");
    }
    await ctx.db.patch("contentState", state._id, {
      activeManifestHash: state.candidateManifestHash,
      activeReleaseId: "release-base",
      activeSequence: 1,
    });
  });
  await t.mutation(stageItems, {
    batchIndex: 0,
    itemJson: [testDeleteJson()],
    releaseId: TEST_RELEASE_ID,
  });
  await t.mutation(stageRoutes, {
    batchIndex: 0,
    releaseId: TEST_RELEASE_ID,
    routeJson: [
      testRouteJson({ operation: "delete", publicPath: "test/deleted" }),
    ],
  });
}

/** Freezes one fully staged fixture before item verification. */
export function beginFixture(t: TestConvex<typeof schema>) {
  return t.mutation(beginVerify, { releaseId: TEST_RELEASE_ID });
}
