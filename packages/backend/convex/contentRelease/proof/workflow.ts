import { internal } from "@repo/backend/convex/_generated/api";
import { workflow } from "@repo/backend/convex/workflow";
import { v } from "convex/values";

/** Runs authenticated proof with durable retries independent of HTTP requests. */
export const verifyRelease = workflow.define({
  args: {
    manifestHash: v.string(),
    releaseId: v.string(),
  },
  returns: v.null(),
  handler: async (step, args) => {
    await step.runAction(
      internal.contentRelease.proof.verify.verifyRelease,
      args,
      {
        retry: {
          base: 2,
          initialBackoffMs: 1000,
          maxAttempts: 3,
        },
      }
    );
    return null;
  },
});
