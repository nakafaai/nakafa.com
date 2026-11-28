import { ContentSnapshotKindSchema } from "@nakafa/aksara-contracts/release/snapshot/scope";
import { workflow } from "@repo/backend/confect/workflow";
import { internal } from "@repo/backend/convex/_generated/api";
import { v } from "convex/values";
import { Array as Arr, Predicate } from "effect";

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
        Arr.map(batchIndexes, (batchIndex) =>
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
      verifiedArtifacts += Arr.reduce(
        receipts,
        0,
        (count, receipt) => count + receipt.verifiedArtifacts
      );
    }
    // Each snapshot family owns a whole action: proving every family inside the
    // final proof outran its ten minutes once assessment passed 30,000 rows.
    const snapshotProofs = await Promise.all(
      Arr.map(ContentSnapshotKindSchema.literals, (family) =>
        step.runAction(
          internal.contentRelease.proof.verify.verifySnapshots,
          { ...args, family },
          {
            name: `verify ${family} snapshot`,
            retry: PROOF_RETRY,
          }
        )
      )
    );
    await step.runAction(
      internal.contentRelease.proof.verify.verifyRelease,
      {
        ...args,
        snapshotProofs: Arr.filter(snapshotProofs, Predicate.isNotNull),
        verifiedArtifacts,
      },
      { retry: PROOF_RETRY }
    );
    return null;
  },
});
