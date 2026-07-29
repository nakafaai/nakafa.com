import { vWorkflowId, type WorkflowStatus } from "@convex-dev/workflow";
import type { ContentFamily } from "@nakafa/aksara-contracts/content";
import { ContentVerificationKeyResolver } from "@nakafa/aksara-contracts/signature/spec";
import { internal } from "@repo/backend/convex/_generated/api";
import {
  ProofPollCoordinator,
  type ProofPollCoordinatorService,
  pollProgram,
} from "@repo/backend/convex/contentRelease/proof/poll";
import { recomputeProgram } from "@repo/backend/convex/contentRelease/proof/verify";
import { beginVerification } from "@repo/backend/convex/contentRelease/verify";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import type schema from "@repo/backend/convex/schema";
import { testArtifactJson } from "@repo/backend/test/content-artifact";
import { testProjectionJson } from "@repo/backend/test/content-material";
import { TEST_KEY_RESOLVER } from "@repo/backend/test/content-proof";
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
import { parse } from "convex-helpers/validators";
import type { TestConvex } from "convex-test";
import { Effect } from "effect";

const stageItems = internal.contentRelease.items.stageItemBatch;
const stageArtifacts = internal.contentRelease.artifacts.stageArtifactBatch;
const stageProjections = internal.contentRelease.items.stageProjectionBatch;
const stageRoutes = internal.contentRelease.routes.stageRouteBatch;
const TEST_PROOF_WORKFLOW_ID = parse(
  vWorkflowId,
  "content-proof-test-workflow"
);
const COMPLETED_PROOF_WORKFLOW_STATUS = {
  result: null,
  type: "completed",
} satisfies WorkflowStatus;
const completedProofCoordinator = {
  cleanup: () => Effect.succeed(true),
  start: () => Effect.dieMessage("Unexpected proof coordinator start."),
  status: () => Effect.succeed(COMPLETED_PROOF_WORKFLOW_STATUS),
} satisfies ProofPollCoordinatorService;

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
  return t.mutation((ctx) =>
    runConvexProgram(beginVerification(ctx, TEST_RELEASE_ID))
  );
}

/** Freezes one release with validator-derived test coordinator identity. */
export async function prepareContentProof(
  target: TestConvex<typeof schema>,
  releaseId: string
) {
  await target.mutation(async (ctx) => {
    await runConvexProgram(beginVerification(ctx, releaseId));
    const release = await ctx.db
      .query("contentReleases")
      .withIndex("by_releaseId", (query) => query.eq("releaseId", releaseId))
      .unique();
    if (release === null) {
      throw new Error(`Expected content release ${releaseId}.`);
    }
    await ctx.db.patch("contentReleases", release._id, {
      proofWorkflowId: TEST_PROOF_WORKFLOW_ID,
    });
  });
}

/** Recomputes proof with the production verifier and technical test key. */
export async function recomputeContentProof(
  target: TestConvex<typeof schema>,
  manifestHash: string,
  releaseId: string
) {
  await prepareContentProof(target, releaseId);
  return target.action((ctx) =>
    Effect.runPromise(
      recomputeProgram(ctx, manifestHash, releaseId).pipe(
        Effect.provideService(ContentVerificationKeyResolver, TEST_KEY_RESOLVER)
      )
    )
  );
}

/** Finalizes recomputed proof when a test owns no Workflow component state. */
export async function completeContentProof(
  target: TestConvex<typeof schema>,
  manifestHash: string,
  releaseId: string
) {
  const proof = await recomputeContentProof(target, manifestHash, releaseId);
  await target.mutation((ctx) =>
    runConvexProgram(
      pollProgram(ctx, manifestHash, releaseId).pipe(
        Effect.provideService(ProofPollCoordinator, completedProofCoordinator)
      )
    )
  );
  return proof;
}
