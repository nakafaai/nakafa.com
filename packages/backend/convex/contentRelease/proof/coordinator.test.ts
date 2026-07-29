// @vitest-environment node

import workflowTest from "@convex-dev/workflow/test";
import { ReleaseIdSchema } from "@nakafa/aksara-contracts/ids";
import { internal } from "@repo/backend/convex/_generated/api";
import { cleanupProofWorkflow } from "@repo/backend/convex/contentRelease/proof/coordinator";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  TEST_PROOF_RENDERER,
  testEmptyManifest,
  testSignedRelease,
} from "@repo/backend/test/content-proof";
import { insertSignedCandidate } from "@repo/backend/test/content-stage";
import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";

const releaseId = ReleaseIdSchema.make("release-proof-coordinator");
const release = testSignedRelease(testEmptyManifest(releaseId));
const abort = internal.contentRelease.manifest.abort;
const poll = internal.contentRelease.proof.poll.poll;

afterEach(() => {
  vi.useRealTimers();
});

describe("contentRelease/proof/coordinator", () => {
  it("does not erase a coordinator before it becomes terminal", async () => {
    vi.useFakeTimers();
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
    await t.mutation(poll, {
      manifestHash: release.manifestHash,
      releaseId,
    });
    const stored = await t.run((ctx) =>
      ctx.db.query("contentReleases").unique()
    );
    const workflowId = stored?.proofWorkflowId;
    if (!workflowId) {
      throw new Error("Expected proof workflow.");
    }

    await expect(
      t.mutation((ctx) =>
        runConvexProgram(cleanupProofWorkflow(ctx, workflowId))
      )
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });
    await expect(t.mutation(abort, { releaseId })).resolves.toMatchObject({
      complete: true,
    });
  });
});
