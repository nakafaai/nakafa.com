// @vitest-environment node

import workflowTest from "@convex-dev/workflow/test";
import {
  ReleaseIdSchema,
  type Sha256Hash,
  Sha256HashSchema,
} from "@nakafa/aksara-contracts/ids";
import { internal } from "@repo/backend/convex/_generated/api";
import { resolveProofWorkflow } from "@repo/backend/convex/contentRelease/proof/poll";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { workflow } from "@repo/backend/convex/workflow";
import {
  TEST_PROOF_RENDERER,
  testEmptyManifest,
  testSignedRelease,
} from "@repo/backend/test/content-proof";
import { insertSignedCandidate } from "@repo/backend/test/content-stage";
import {
  completeContentProof,
  recomputeContentProof,
} from "@repo/backend/test/content-verify";
import { convexTest, type TestConvex } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@repo/backend/content/trust", async () => {
  const { TEST_KEY_RESOLVER } = await import(
    "@repo/backend/test/content-proof"
  );
  return { contentKeyResolver: TEST_KEY_RESOLVER };
});

const releaseId = ReleaseIdSchema.make("release-proof-workflow");
const release = testSignedRelease(testEmptyManifest(releaseId));
const abort = internal.contentRelease.manifest.abort;
const poll = internal.contentRelease.proof.poll.poll;
const status = internal.contentRelease.status.getStatus;

/** Creates a candidate and its real Workflow component test runtime. */
async function createCandidate() {
  const t = convexTest(schema, convexModules);
  workflowTest.register(t);
  await t.mutation((ctx) =>
    insertSignedCandidate(
      ctx,
      releaseId,
      release,
      JSON.stringify(TEST_PROOF_RENDERER)
    )
  );
  return t;
}

/** Invokes the exact private polling mutation used by publication ingress. */
function pollProof(
  t: TestConvex<typeof schema>,
  manifestHash: Sha256Hash = release.manifestHash
) {
  return t.mutation(poll, { manifestHash, releaseId });
}

afterEach(() => {
  vi.useRealTimers();
});

describe("contentRelease/proof/poll", () => {
  it("rejects a manifest identity that does not own the staged release", async () => {
    const t = await createCandidate();
    await expect(
      pollProof(
        t,
        Sha256HashSchema.make(
          "sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
        )
      )
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_CONFLICT" },
    });
  });

  it("starts exactly once and returns proof after the workflow completes", async () => {
    // Effect yields through setImmediate, while Convex jobs use timer APIs.
    vi.useFakeTimers({
      toFake: [
        "Date",
        "clearInterval",
        "clearTimeout",
        "setInterval",
        "setTimeout",
      ],
    });
    const t = await createCandidate();

    await expect(Promise.all([pollProof(t), pollProof(t)])).resolves.toEqual([
      { phase: "verifying" },
      { phase: "verifying" },
    ]);
    const started = await t.run((ctx) =>
      ctx.db.query("contentReleases").unique()
    );
    if (!started?.proofWorkflowId) {
      throw new Error("Expected proof workflow.");
    }
    await expect(pollProof(t)).resolves.toEqual({ phase: "verifying" });
    const repeated = await t.run((ctx) =>
      ctx.db.query("contentReleases").unique()
    );

    expect(repeated?.proofWorkflowId).toBe(started.proofWorkflowId);
    await expect(
      t.query(status, {
        manifestHash: release.manifestHash,
        releaseId,
      })
    ).resolves.toMatchObject({ phase: "verifying" });
    await t.mutation(abort, { releaseId });

    const completedTarget = await createCandidate();
    await recomputeContentProof(
      completedTarget,
      release.manifestHash,
      releaseId
    );
    const proved = await completedTarget.run((ctx) =>
      ctx.db.query("contentReleases").unique()
    );
    expect(proved).toMatchObject({
      proofJson: expect.any(String),
      proofWorkflowId: expect.any(String),
      status: "verifying",
    });
    await completeContentProof(
      completedTarget,
      release.manifestHash,
      releaseId
    );
    const result = await pollProof(completedTarget);
    const completed = await completedTarget.run((ctx) =>
      ctx.db.query("contentReleases").unique()
    );

    expect(result).toMatchObject({
      phase: "verified",
      proofJson: expect.any(String),
    });
    expect(completed).toMatchObject({
      status: "verified",
    });
    expect(completed).not.toHaveProperty("proofWorkflowId");
    await expect(
      completedTarget.query(status, {
        manifestHash: release.manifestHash,
        releaseId,
      })
    ).resolves.toMatchObject({ phase: "verified" });
  });

  it("resumes a verifying release that predates durable coordinator identity", async () => {
    vi.useFakeTimers();
    const t = await createCandidate();
    await t.mutation(async (ctx) => {
      const stored = await ctx.db.query("contentReleases").unique();
      if (!stored) {
        throw new Error("Expected proof release.");
      }
      await ctx.db.patch("contentReleases", stored._id, {
        status: "verifying",
      });
    });

    await expect(pollProof(t)).resolves.toEqual({ phase: "verifying" });
    const resumed = await t.run((ctx) =>
      ctx.db.query("contentReleases").unique()
    );
    expect(resumed).toMatchObject({
      proofWorkflowId: expect.any(String),
      status: "verifying",
    });
    await expect(t.mutation(abort, { releaseId })).resolves.toMatchObject({
      complete: true,
    });
  });

  it("fails closed when a completed coordinator did not persist proof", () => {
    expect(
      resolveProofWorkflow({ result: null, type: "completed" }, undefined)
    ).toEqual({
      phase: "failed",
      reason: "failed",
    });
    expect(
      resolveProofWorkflow({ result: null, type: "completed" }, "{}")
    ).toEqual({
      phase: "ready",
      proofJson: "{}",
    });
  });

  it("retains one sanitized failure after coordinator retries finish", async () => {
    const t = await createCandidate();
    await t.mutation(async (ctx) => {
      const stored = await ctx.db.query("contentReleases").unique();
      if (!stored) {
        throw new Error("Expected proof release.");
      }
      await ctx.db.patch("contentReleases", stored._id, {
        proofFailure: "failed",
        status: "verifying",
      });
    });

    await expect(pollProof(t)).resolves.toEqual({
      phase: "failed",
      reason: "failed",
    });
    await expect(pollProof(t)).resolves.toEqual({
      phase: "failed",
      reason: "failed",
    });
    const failed = await t.run((ctx) =>
      ctx.db.query("contentReleases").unique()
    );

    expect(failed).toMatchObject({
      proofFailure: "failed",
      status: "verifying",
    });
    expect(failed).not.toHaveProperty("proofWorkflowId");
    await expect(
      t.query(status, {
        manifestHash: release.manifestHash,
        releaseId,
      })
    ).resolves.toMatchObject({ phase: "verifying" });
  });

  it("retains cancellation without exposing component workflow details", async () => {
    vi.useFakeTimers();
    const t = await createCandidate();
    await pollProof(t);
    const stored = await t.run((ctx) =>
      ctx.db.query("contentReleases").unique()
    );
    const workflowId = stored?.proofWorkflowId;
    if (!workflowId) {
      throw new Error("Expected proof workflow.");
    }
    await t.mutation((ctx) => workflow.cancel(ctx, workflowId));

    await expect(pollProof(t)).resolves.toEqual({
      phase: "failed",
      reason: "canceled",
    });
    const canceled = await t.run((ctx) =>
      ctx.db.query("contentReleases").unique()
    );
    expect(canceled).toMatchObject({
      proofFailure: "canceled",
      status: "verifying",
    });
    expect(canceled).not.toHaveProperty("proofWorkflowId");
  });

  it("cancels and cleans an in-progress workflow before aborting rows", async () => {
    vi.useFakeTimers();
    const t = await createCandidate();
    await pollProof(t);

    await expect(t.mutation(abort, { releaseId })).resolves.toMatchObject({
      complete: true,
      releaseId,
    });
    const aborted = await t.run((ctx) =>
      ctx.db.query("contentReleases").unique()
    );

    expect(aborted).toMatchObject({
      status: "aborted",
    });
    expect(aborted).not.toHaveProperty("proofFailure");
    expect(aborted).not.toHaveProperty("proofWorkflowId");
  });
});
