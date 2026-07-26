import type { ContentFamily } from "@nakafa/aksara-contracts/content";
import { internal } from "@repo/backend/convex/_generated/api";
import type schema from "@repo/backend/convex/schema";
import { testArtifactJson } from "@repo/backend/test/content-artifact";
import { testProjectionJson } from "@repo/backend/test/content-material";
import {
  TEST_RELEASE_ID,
  testDeleteJson,
  testRouteJson,
  testUpsertJson,
} from "@repo/backend/test/content-release";
import {
  TEST_ARTICLE_KEY,
  TEST_ARTICLE_PATH,
  TEST_ARTICLE_PROJECTION_JSON,
  TEST_ARTICLE_SOURCE,
} from "@repo/backend/test/content-runtime";
import { insertTestRelease } from "@repo/backend/test/content-stage";
import {
  insertRuntimeBinding,
  insertRuntimeVersion,
} from "@repo/backend/test/runtime-head";
import type { TestConvex } from "convex-test";

const stageItems = internal.contentRelease.items.stageItemBatch;
const stageArtifacts = internal.contentRelease.artifacts.stageArtifactBatch;
const stageProjections = internal.contentRelease.items.stageProjectionBatch;
const stageRoutes = internal.contentRelease.routes.stageRouteBatch;
const beginVerify = internal.contentRelease.verify.begin;

/** Selects one complete family-owned upsert fixture without parallel helpers. */
function upsertFixture(family: ContentFamily) {
  if (family === "article") {
    return {
      artifactJson: testArtifactJson({
        contentKey: TEST_ARTICLE_KEY,
        rendererDomain: "politics",
      }),
      itemJson: testUpsertJson({
        contentKey: TEST_ARTICLE_KEY,
        family,
        rendererDomain: "politics",
        sourcePath: TEST_ARTICLE_SOURCE,
      }),
      projectionJson: TEST_ARTICLE_PROJECTION_JSON,
      routeJson: testRouteJson({
        contentKey: TEST_ARTICLE_KEY,
        publicPath: TEST_ARTICLE_PATH,
      }),
    };
  }
  return {
    artifactJson: testArtifactJson(),
    itemJson: testUpsertJson(),
    projectionJson: testProjectionJson(),
    routeJson: testRouteJson(),
  };
}

/** Stages one complete technical upsert through every real mutation. */
export async function stageUpsertFixture(
  t: TestConvex<typeof schema>,
  family: ContentFamily = "material"
) {
  const fixture = upsertFixture(family);
  await t.mutation((ctx) => insertTestRelease(ctx));
  await t.mutation(stageItems, {
    batchIndex: 0,
    itemJson: [fixture.itemJson],
    releaseId: TEST_RELEASE_ID,
  });
  await t.mutation(stageArtifacts, {
    artifactJson: [fixture.artifactJson],
    batchIndex: 0,
    releaseId: TEST_RELEASE_ID,
  });
  await t.mutation(stageProjections, {
    batchIndex: 0,
    projectionJson: [fixture.projectionJson],
    releaseId: TEST_RELEASE_ID,
  });
  await t.mutation(stageRoutes, {
    batchIndex: 0,
    releaseId: TEST_RELEASE_ID,
    routeJson: [fixture.routeJson],
  });
}

/** Stages one complete delete plus its required route tombstone. */
export async function stageDeleteFixture(
  t: TestConvex<typeof schema>,
  family: ContentFamily = "material"
) {
  const article = family === "article";
  const contentKey = article ? TEST_ARTICLE_KEY : "test:deleted";
  const publicPath = article ? TEST_ARTICLE_PATH : "test/deleted";
  const projectionJson = article
    ? TEST_ARTICLE_PROJECTION_JSON
    : testProjectionJson({ contentKey, publicPath });
  await t.mutation(async (ctx) => {
    await insertTestRelease(ctx, {
      deleteCount: 1,
      projectionCount: 0,
      routeCount: 1,
      sequence: 2,
      upsertCount: 0,
    });
    await insertRuntimeVersion(ctx, "public", contentKey, {
      headReleaseId: "release-base",
      headSequence: 1,
      projectionJson,
      publicPath,
      rendererDomain: article ? "politics" : "mathematics",
      sourcePath: article ? TEST_ARTICLE_SOURCE : undefined,
    });
    await insertRuntimeBinding(ctx, contentKey, {
      bindingReleaseId: "release-base",
      bindingSequence: 1,
      publicPath,
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
    itemJson: [testDeleteJson({ contentKey, family })],
    releaseId: TEST_RELEASE_ID,
  });
  await t.mutation(stageRoutes, {
    batchIndex: 0,
    releaseId: TEST_RELEASE_ID,
    routeJson: [testRouteJson({ operation: "delete", publicPath })],
  });
}

/** Freezes one fully staged fixture before item verification. */
export function beginFixture(t: TestConvex<typeof schema>) {
  return t.mutation(beginVerify, { releaseId: TEST_RELEASE_ID });
}
