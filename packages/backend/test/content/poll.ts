import workflowTest from "@convex-dev/workflow/test";
import { ReleaseIdSchema, type Sha256Hash } from "@nakafa/aksara-contracts/ids";
import type { SignedContentRelease } from "@nakafa/aksara-contracts/release";
import { RendererManifestEnvelopeSchema } from "@nakafa/aksara-contracts/renderer/contract";
import type { ProofStatus } from "@repo/backend/confect/contentRelease/proof/poll";
import { internal } from "@repo/backend/convex/_generated/api";
import type schema from "@repo/backend/convex/schema";
import { TEST_PROOF_RENDERER } from "@repo/backend/test/content/proof";
import { insertSignedCandidate } from "@repo/backend/test/content/stage";
import { makeFunctionReference } from "convex/server";
import type { TestConvex } from "convex-test";
import { Schema } from "effect";

/** The release id that every proof poll test stages. */
export const pollReleaseId = ReleaseIdSchema.make("release-proof-workflow");
const poll = internal.contentRelease.proof.poll.poll;
const pollStatus = makeFunctionReference<
  "query",
  { manifestHash: string; releaseId: string },
  ProofStatus
>("contentRelease/proof/poll:status");

/** Registers the real Workflow component, then stages the candidate in the test client. */
export async function createCandidate(
  t: TestConvex<typeof schema>,
  release: SignedContentRelease
) {
  workflowTest.register(t);
  await t.mutation((ctx) =>
    insertSignedCandidate(
      ctx,
      pollReleaseId,
      release,
      Schema.encodeSync(Schema.fromJsonString(RendererManifestEnvelopeSchema))(
        TEST_PROOF_RENDERER
      )
    )
  );
}

/** Invokes the exact private polling mutation used by publication ingress. */
export function pollProof(
  t: TestConvex<typeof schema>,
  manifestHash: Sha256Hash
) {
  return t.mutation(poll, {
    manifestHash,
    releaseId: pollReleaseId,
  });
}

/** Reads the one stored release row that a poll may patch. */
function storedRelease(t: TestConvex<typeof schema>) {
  return t.run((ctx) => ctx.db.query("contentReleases").unique());
}

/** Reads the status query, then the poll mutation, for one release state. */
export async function observePoll(
  t: TestConvex<typeof schema>,
  release: SignedContentRelease
) {
  const before = await storedRelease(t);
  const observed = await t.query(pollStatus, {
    manifestHash: release.manifestHash,
    releaseId: pollReleaseId,
  });
  const polled = await pollProof(t, release.manifestHash);
  const after = await storedRelease(t);
  return { after, before, observed, polled };
}
