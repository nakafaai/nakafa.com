import { internal } from "@repo/backend/convex/_generated/api";
import { workflow } from "@repo/backend/convex/workflow";
import { v } from "convex/values";

const ARTIFACT_PROOF_PARALLELISM = 4;
const PROOF_RETRY = {
  base: 2,
  initialBackoffMs: 1000,
  maxAttempts: 3,
};

/** Runs authenticated proof with durable retries independent of HTTP requests. */
export const verifyRelease = workflow.define({
  args: {
    manifestHash: v.string(),
    releaseId: v.string(),
  },
  returns: v.null(),
  handler: async (step, args) => {
    const plan = await step.runQuery(
      internal.contentRelease.proof.read.artifactPlan,
      args
    );
    let verifiedArtifacts = 0;
    for (
      let start = 0;
      start < plan.batchCount;
      start += ARTIFACT_PROOF_PARALLELISM
    ) {
      const remaining = plan.batchCount - start;
      const length = Math.min(ARTIFACT_PROOF_PARALLELISM, remaining);
      const batchIndexes = Array.from({ length }, (_, index) => start + index);
      const receipts = await Promise.all(
        batchIndexes.map((batchIndex) =>
          step.runAction(
            internal.contentRelease.proof.verify.verifyArtifacts,
            { ...args, batchIndex },
            {
              name: `verify artifact batch ${batchIndex}`,
              retry: PROOF_RETRY,
            }
          )
        )
      );
      verifiedArtifacts += receipts.reduce(
        (count, receipt) => count + receipt.verifiedArtifacts,
        0
      );
    }
    await step.runAction(
      internal.contentRelease.proof.verify.verifyRelease,
      { ...args, verifiedArtifacts },
      { retry: PROOF_RETRY }
    );
    return null;
  },
});
