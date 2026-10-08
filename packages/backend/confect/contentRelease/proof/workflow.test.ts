// @vitest-environment node

import { afterEach, expect, it } from "@effect/vitest";
import { SignedContentArtifactSchema } from "@nakafa/aksara-contracts/content";
import { ContentProjectionSchema } from "@nakafa/aksara-contracts/projection/spec";
import { ContentReleaseItemSchema } from "@nakafa/aksara-contracts/release";
import { ContentRouteItemSchema } from "@nakafa/aksara-contracts/release/route/spec";
import { RendererManifestEnvelopeSchema } from "@nakafa/aksara-contracts/renderer/contract";
import { convexModules } from "@repo/backend/confect/test.setup";
import { workflow } from "@repo/backend/confect/workflow";
import { internal } from "@repo/backend/convex/_generated/api";
import schema from "@repo/backend/convex/schema";
import {
  ingressArtifact,
  ingressItem,
  ingressProjection,
  ingressRelease,
  ingressReleaseId,
  ingressRoute,
} from "@repo/backend/test/content/ingress";
import { TEST_PROOF_RENDERER } from "@repo/backend/test/content/proof";
import { insertSignedCandidate } from "@repo/backend/test/content/stage";
import { registerWorkflow } from "@repo/backend/test/workflow";
import { convexTest } from "convex-test";
import { Schema } from "effect";

vi.mock("@repo/backend/content/trust", async () => {
  const { TEST_KEY_RESOLVER } = await import(
    "@repo/backend/test/content/proof"
  );
  return { contentKeyResolver: TEST_KEY_RESOLVER };
});

afterEach(() => {
  vi.useRealTimers();
});

it("authenticates staged artifacts and final proof through the durable Workflow before releasing its journal", async () => {
  // Effect's Node scheduler uses setImmediate; only Convex timers advance here.
  vi.useFakeTimers({
    toFake: [
      "Date",
      "clearInterval",
      "clearTimeout",
      "setInterval",
      "setTimeout",
    ],
  });
  const t = convexTest(schema, convexModules);
  await registerWorkflow(t);
  await t.mutation((ctx) =>
    insertSignedCandidate(
      ctx,
      ingressReleaseId,
      ingressRelease,
      Schema.encodeSync(Schema.fromJsonString(RendererManifestEnvelopeSchema))(
        TEST_PROOF_RENDERER
      )
    )
  );
  await t.mutation(internal.contentRelease.items.stageItemBatch, {
    releaseId: ingressReleaseId,
    batchIndex: 0,
    itemJson: [
      Schema.encodeSync(Schema.fromJsonString(ContentReleaseItemSchema))(
        ingressItem
      ),
    ],
  });
  await t.mutation(internal.contentRelease.routes.stageRouteBatch, {
    releaseId: ingressReleaseId,
    batchIndex: 0,
    routeJson: [
      Schema.encodeSync(Schema.fromJsonString(ContentRouteItemSchema))(
        ingressRoute
      ),
    ],
  });
  await t.mutation(internal.contentRelease.items.stageProjectionBatch, {
    releaseId: ingressReleaseId,
    batchIndex: 0,
    projectionJson: [
      Schema.encodeSync(Schema.fromJsonString(ContentProjectionSchema))(
        ingressProjection
      ),
    ],
  });
  await t.mutation(internal.contentRelease.artifacts.stageArtifactBatch, {
    releaseId: ingressReleaseId,
    batchIndex: 0,
    artifactJson: [
      Schema.encodeSync(Schema.fromJsonString(SignedContentArtifactSchema))(
        ingressArtifact
      ),
    ],
  });
  const identity = {
    releaseId: ingressReleaseId,
    manifestHash: ingressRelease.manifestHash,
  };
  await expect(
    t.mutation(internal.contentRelease.proof.poll.poll, identity)
  ).resolves.toEqual({ phase: "verifying" });
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  const completed = await t.query((ctx) => workflow.list(ctx));
  expect(completed.page).toHaveLength(1);
  expect(completed.page[0]).toMatchObject({
    runResult: { kind: "success", returnValue: null },
  });
  await expect(
    t.mutation(internal.contentRelease.proof.poll.poll, identity)
  ).resolves.toMatchObject({
    phase: "verified",
    proofJson: expect.any(String),
  });

  const state = await t.query(async (ctx) => ({
    release: await ctx.db.query("contentReleases").unique(),
    workflows: await workflow.list(ctx),
  }));
  expect(state.release).toMatchObject({
    checkedItems: 1,
    checkedIndex: 0,
    stagedArtifacts: 1,
    status: "verified",
  });
  expect(state.release).not.toHaveProperty("proofWorkflowId");
  expect(state.release).not.toHaveProperty("proofFailure");
  expect(state.workflows.page).toEqual([]);
});
