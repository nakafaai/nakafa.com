import {
  DatabaseReader as ConfectDatabaseReader,
  RegisteredConvexFunction,
} from "@confect/server";
import confectSchema from "@repo/backend/confect/_generated/schema";
import { loadRelease } from "@repo/backend/confect/contentRelease/model";
import { Effect } from "effect";
// @vitest-environment node

import workflowTest from "@convex-dev/workflow/test";
import { afterEach, describe, expect, it } from "@effect/vitest";
import { ReleaseIdSchema } from "@nakafa/aksara-contracts/ids";
import { cleanupProofWorkflow } from "@repo/backend/confect/contentRelease/proof/coordinator";
import { convexModules } from "@repo/backend/confect/test.setup";
import { workflow } from "@repo/backend/confect/workflow";
import { internal } from "@repo/backend/convex/_generated/api";
import schema from "@repo/backend/convex/schema";
import {
  TEST_PROOF_RENDERER,
  testEmptyManifest,
  testSignedRelease,
} from "@repo/backend/test/content/proof";
import { insertSignedCandidate } from "@repo/backend/test/content/stage";
import { convexTest } from "convex-test";

const releaseId = ReleaseIdSchema.make("release-proof-coordinator");
const release = testSignedRelease(testEmptyManifest(releaseId));
const abort = internal.contentRelease.manifest.abort;
const poll = internal.contentRelease.proof.poll.poll;
afterEach(() => {
  vi.useRealTimers();
});
describe("contentRelease/proof/coordinator", () => {
  it.each([false, true])(
    "retains running evidence and aborts with prior cancellation %s",
    async (cancelFirst) => {
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
      const stored = await t.query((ctx) =>
        Effect.runPromise(
          loadRelease(releaseId).pipe(
            Effect.provide(ConfectDatabaseReader.layer(confectSchema, ctx.db))
          )
        )
      );
      const workflowId = stored?.proofWorkflowId;
      if (!workflowId) {
        throw new Error("Expected proof workflow.");
      }
      await expect(
        t.mutation((ctx) =>
          Effect.runPromise(
            cleanupProofWorkflow(workflowId).pipe(
              Effect.provide(
                RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
              )
            )
          )
        )
      ).rejects.toMatchObject({
        code: "CONTENT_RELEASE_INTEGRITY",
      });
      if (cancelFirst) {
        await t.mutation((ctx) => workflow.cancel(ctx, workflowId));
      }
      await expect(
        t.mutation(abort, {
          releaseId,
        })
      ).resolves.toMatchObject({
        complete: true,
      });
    }
  );
});
