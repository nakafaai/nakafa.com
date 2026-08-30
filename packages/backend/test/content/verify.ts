import { vWorkflowId, type WorkflowStatus } from "@convex-dev/workflow";
import type { ContentFamily } from "@nakafa/aksara-contracts/content";
import { ContentVerificationKeyResolver } from "@nakafa/aksara-contracts/signature/spec";
import { internal } from "@repo/backend/convex/_generated/api";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import {
  ProofPollCoordinator,
  type ProofPollCoordinatorService,
  pollProgram,
} from "@repo/backend/convex/contentRelease/proof/poll";
import {
  recomputeProgram,
  verifyArtifactBatchProgram,
} from "@repo/backend/convex/contentRelease/proof/verify";
import { beginVerification } from "@repo/backend/convex/contentRelease/verify";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import type schema from "@repo/backend/convex/schema";
import { testArtifactJson } from "@repo/backend/test/content/artifact";
import { testProjectionJson } from "@repo/backend/test/content/material";
import {
  TEST_PAGE_KEY,
  TEST_PAGE_PATH,
  TEST_PAGE_PROJECTION_JSON,
  TEST_PAGE_SOURCE,
} from "@repo/backend/test/content/page";
import { TEST_KEY_RESOLVER } from "@repo/backend/test/content/proof";
import {
  TEST_RELEASE_ID,
  testDeleteJson,
  testRouteJson,
  testUpsertJson,
} from "@repo/backend/test/content/release";
import {
  TEST_ARTICLE_KEY,
  TEST_ARTICLE_PATH,
  TEST_ARTICLE_PROJECTION_JSON,
  TEST_ARTICLE_SOURCE,
} from "@repo/backend/test/content/runtime";
import { insertTestRelease } from "@repo/backend/test/content/stage";
import {
  insertRuntimeBinding,
  insertRuntimeVersion,
} from "@repo/backend/test/runtime/head";
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
  start: () => Effect.die(new Error("Unexpected proof coordinator start.")),
  status: () => Effect.succeed(COMPLETED_PROOF_WORKFLOW_STATUS),
} satisfies ProofPollCoordinatorService;
type RoutedContentFamily = Exclude<ContentFamily, "question">;
/** Selects one complete family-owned upsert fixture without parallel helpers. */
function upsertFixture(family: RoutedContentFamily) {
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
  if (family === "page") {
    return {
      artifactJson: testArtifactJson({
        contentKey: TEST_PAGE_KEY,
        rendererDomain: "site",
      }),
      itemJson: testUpsertJson({
        contentKey: TEST_PAGE_KEY,
        family,
        rendererDomain: "site",
        sourcePath: TEST_PAGE_SOURCE,
      }),
      projectionJson: TEST_PAGE_PROJECTION_JSON,
      routeJson: testRouteJson({
        contentKey: TEST_PAGE_KEY,
        publicPath: TEST_PAGE_PATH,
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
/** Selects one complete prior routed state for a deletion fixture. */
function deleteFixture(family: RoutedContentFamily) {
  if (family === "article") {
    return {
      contentKey: TEST_ARTICLE_KEY,
      projectionJson: TEST_ARTICLE_PROJECTION_JSON,
      publicPath: TEST_ARTICLE_PATH,
      rendererDomain: "politics" as const,
      sourcePath: TEST_ARTICLE_SOURCE,
    };
  }
  if (family === "page") {
    return {
      contentKey: TEST_PAGE_KEY,
      projectionJson: TEST_PAGE_PROJECTION_JSON,
      publicPath: TEST_PAGE_PATH,
      rendererDomain: "site" as const,
      sourcePath: TEST_PAGE_SOURCE,
    };
  }
  const contentKey = "test:deleted";
  const publicPath = "subjects/test/deleted";
  return {
    contentKey,
    projectionJson: testProjectionJson({ contentKey, publicPath }),
    publicPath,
    rendererDomain: "mathematics" as const,
    sourcePath: undefined,
  };
}
/** Stages one complete technical upsert through every real mutation. */
export async function stageUpsertFixture(
  t: TestConvex<typeof schema>,
  family: RoutedContentFamily = "material",
  role: Doc<"contentReleases">["role"] = "candidate"
) {
  const fixture = upsertFixture(family);
  await t.mutation((ctx) => insertTestRelease(ctx, { role }));
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
  family: RoutedContentFamily = "material"
) {
  const fixture = deleteFixture(family);
  await t.mutation(async (ctx) => {
    await insertTestRelease(ctx, {
      deleteCount: 1,
      projectionCount: 0,
      routeCount: 1,
      sequence: 2,
      upsertCount: 0,
    });
    await insertRuntimeVersion(ctx, "public", fixture.contentKey, {
      headReleaseId: "release-base",
      headSequence: 1,
      projectionJson: fixture.projectionJson,
      publicPath: fixture.publicPath,
      rendererDomain: fixture.rendererDomain,
      sourcePath: fixture.sourcePath,
    });
    await insertRuntimeBinding(ctx, fixture.contentKey, {
      bindingReleaseId: "release-base",
      bindingSequence: 1,
      publicPath: fixture.publicPath,
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
    itemJson: [testDeleteJson({ contentKey: fixture.contentKey, family })],
    releaseId: TEST_RELEASE_ID,
  });
  await t.mutation(stageRoutes, {
    batchIndex: 0,
    releaseId: TEST_RELEASE_ID,
    routeJson: [
      testRouteJson({
        operation: "delete",
        publicPath: fixture.publicPath,
      }),
    ],
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
  releaseId: string,
  resolver = TEST_KEY_RESOLVER
) {
  await prepareContentProof(target, releaseId);
  const plan = await target.query(
    internal.contentRelease.proof.read.artifactPlan,
    { manifestHash, releaseId }
  );
  let verifiedArtifacts = 0;
  for (let batchIndex = 0; batchIndex < plan.batchCount; batchIndex += 1) {
    const receipt = await target.action((ctx) =>
      Effect.runPromise(
        verifyArtifactBatchProgram(
          ctx,
          manifestHash,
          releaseId,
          batchIndex
        ).pipe(Effect.provideService(ContentVerificationKeyResolver, resolver))
      )
    );
    verifiedArtifacts += receipt.verifiedArtifacts;
  }
  return target.action((ctx) =>
    Effect.runPromise(
      recomputeProgram(ctx, manifestHash, releaseId, verifiedArtifacts).pipe(
        Effect.provideService(ContentVerificationKeyResolver, resolver)
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
