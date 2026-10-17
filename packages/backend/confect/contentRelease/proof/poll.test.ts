import { DatabaseReader as ConfectDatabaseReader } from "@confect/server";
import confectSchema from "@repo/backend/confect/_generated/schema";
import { loadRelease } from "@repo/backend/confect/contentRelease/model";
import { Effect } from "effect";
// @vitest-environment node

import { afterEach, assert, describe, expect, it } from "@effect/vitest";
import { Sha256HashSchema } from "@nakafa/aksara-contracts/ids";
import type { SignedContentRelease } from "@nakafa/aksara-contracts/release";
import { resolveProofWorkflow } from "@repo/backend/confect/contentRelease/proof/poll";
import { convexModules } from "@repo/backend/confect/test.setup";
import { workflow } from "@repo/backend/confect/workflow";
import { internal } from "@repo/backend/convex/_generated/api";
import schema from "@repo/backend/convex/schema";
import {
  createCandidate,
  observePoll,
  pollProof,
  pollReleaseId,
} from "@repo/backend/test/content/poll";
import { testSignedEmptyRelease } from "@repo/backend/test/content/proof";
import {
  completeContentProof,
  recomputeContentProof,
} from "@repo/backend/test/content/verify";
import { convexTest } from "convex-test";

vi.mock("@repo/backend/content/trust", async () => {
  const { TEST_KEY_RESOLVER } = await import(
    "@repo/backend/test/content/proof"
  );
  return {
    contentKeyResolver: TEST_KEY_RESOLVER,
  };
});
const releaseId = pollReleaseId;
const abort = internal.contentRelease.manifest.abort;
const status = internal.contentRelease.status.getStatus;

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});
/** Signs the poll release for one test, then runs its promise-based body with it. */
function itWithRelease(
  name: string,
  body: (release: SignedContentRelease) => void | Promise<void>
) {
  return it.effect(name, () =>
    Effect.gen(function* () {
      const release = yield* testSignedEmptyRelease(releaseId);
      yield* Effect.promise(async () => body(release));
    })
  );
}

/** Creates a fresh test client that already holds the candidate for one release. */
async function candidateTest(release: SignedContentRelease) {
  const t = convexTest(schema, convexModules);
  await createCandidate(t, release);
  return t;
}

describe("contentRelease/proof/poll", () => {
  itWithRelease(
    "rejects a manifest identity that does not own the staged release",
    async (release) => {
      const t = await candidateTest(release);
      await expect(
        pollProof(
          t,
          Sha256HashSchema.make(
            "sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
          )
        )
      ).rejects.toMatchObject({
        data: {
          code: "CONTENT_RELEASE_CONFLICT",
        },
      });
    }
  );
  itWithRelease(
    "starts exactly once and returns proof after the workflow completes",
    async (release) => {
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
      const t = await candidateTest(release);
      await expect(
        Promise.all([
          pollProof(t, release.manifestHash),
          pollProof(t, release.manifestHash),
        ])
      ).resolves.toEqual([
        {
          phase: "verifying",
        },
        {
          phase: "verifying",
        },
      ]);
      const started = await t.run((ctx) =>
        ctx.db.query("contentReleases").unique()
      );
      assert(started?.proofWorkflowId, "Expected proof workflow.");
      await expect(pollProof(t, release.manifestHash)).resolves.toEqual({
        phase: "verifying",
      });
      const repeated = await t.run((ctx) =>
        ctx.db.query("contentReleases").unique()
      );
      expect(repeated?.proofWorkflowId).toBe(started.proofWorkflowId);
      await expect(
        t.query(status, {
          manifestHash: release.manifestHash,
          releaseId,
        })
      ).resolves.toMatchObject({
        phase: "verifying",
      });
      await t.mutation(abort, {
        releaseId,
      });
      const completedTarget = await candidateTest(release);
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
      const result = await pollProof(completedTarget, release.manifestHash);
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
      ).resolves.toMatchObject({
        phase: "verified",
      });
    }
  );
  itWithRelease(
    "resumes a verifying release that predates durable coordinator identity",
    async (release) => {
      vi.useFakeTimers();
      const t = await candidateTest(release);
      await t.mutation(async (ctx) => {
        const stored = await ctx.db.query("contentReleases").unique();
        assert(stored, "Expected proof release.");
        await ctx.db.patch("contentReleases", stored._id, {
          status: "verifying",
        });
      });
      await expect(pollProof(t, release.manifestHash)).resolves.toEqual({
        phase: "verifying",
      });
      const resumed = await t.run((ctx) =>
        ctx.db.query("contentReleases").unique()
      );
      expect(resumed).toMatchObject({
        proofWorkflowId: expect.any(String),
        status: "verifying",
      });
      await expect(
        t.mutation(abort, {
          releaseId,
        })
      ).resolves.toMatchObject({
        complete: true,
      });
    }
  );
  itWithRelease(
    "fails closed when a completed coordinator did not persist proof",
    () => {
      expect(
        resolveProofWorkflow(
          {
            result: null,
            type: "completed",
          },
          undefined
        )
      ).toEqual({
        phase: "failed",
        reason: "failed",
      });
      expect(
        resolveProofWorkflow(
          {
            result: null,
            type: "completed",
          },
          "{}"
        )
      ).toEqual({
        phase: "ready",
        proofJson: "{}",
      });
    }
  );
  itWithRelease(
    "retains one sanitized failure after coordinator retries finish",
    async (release) => {
      const t = await candidateTest(release);
      await t.mutation(async (ctx) => {
        const stored = await ctx.db.query("contentReleases").unique();
        assert(stored, "Expected proof release.");
        await ctx.db.patch("contentReleases", stored._id, {
          proofFailure: "failed",
          status: "verifying",
        });
      });
      await expect(pollProof(t, release.manifestHash)).resolves.toEqual({
        phase: "failed",
        reason: "failed",
      });
      await expect(pollProof(t, release.manifestHash)).resolves.toEqual({
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
      ).resolves.toMatchObject({
        phase: "verifying",
      });
    }
  );
  itWithRelease(
    "retains cancellation without exposing component workflow details",
    async (release) => {
      vi.useFakeTimers();
      const t = await candidateTest(release);
      await pollProof(t, release.manifestHash);
      const stored = await t.query((ctx) =>
        Effect.runPromise(
          loadRelease(releaseId).pipe(
            Effect.provide(ConfectDatabaseReader.layer(confectSchema, ctx.db))
          )
        )
      );
      const workflowId = stored?.proofWorkflowId;
      assert(workflowId, "Expected proof workflow.");
      await t.mutation((ctx) => workflow.cancel(ctx, workflowId));
      await expect(pollProof(t, release.manifestHash)).resolves.toEqual({
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
    }
  );
  itWithRelease(
    "cancels and cleans an in-progress workflow before aborting rows",
    async (release) => {
      vi.useFakeTimers();
      const t = await candidateTest(release);
      await pollProof(t, release.manifestHash);
      await expect(
        t.mutation(abort, {
          releaseId,
        })
      ).resolves.toMatchObject({
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
    }
  );
  itWithRelease(
    "retains coordinator ownership when terminal workflow cleanup is refused",
    async (release) => {
      vi.useFakeTimers({
        toFake: ["Date", "setTimeout", "clearTimeout"],
      });
      const t = await candidateTest(release);
      await pollProof(t, release.manifestHash);
      const before = await t.query((ctx) =>
        ctx.db.query("contentReleases").unique()
      );
      vi.spyOn(workflow, "status").mockResolvedValueOnce({
        type: "completed",
        result: null,
      });
      vi.spyOn(workflow, "cleanup").mockResolvedValueOnce(false);
      await expect(pollProof(t, release.manifestHash)).rejects.toMatchObject({
        data: {
          code: "CONTENT_RELEASE_INTEGRITY",
        },
      });
      expect(
        await t.query((ctx) => ctx.db.query("contentReleases").unique())
      ).toEqual(before);
    }
  );
  itWithRelease(
    "answers a stored proof from the status query without writing",
    async (release) => {
      const t = await candidateTest(release);
      await completeContentProof(t, release.manifestHash, releaseId);
      const { after, before, observed, polled } = await observePoll(t, release);
      expect(observed).toEqual({
        phase: "verified",
        proofJson: expect.any(String),
      });
      expect(polled).toEqual(observed);
      expect(after).toEqual(before);
    }
  );
  itWithRelease(
    "keeps a running proof workflow verifying without writing",
    async (release) => {
      vi.useFakeTimers();
      const t = await candidateTest(release);
      await pollProof(t, release.manifestHash);
      const { after, before, observed, polled } = await observePoll(t, release);
      expect(observed).toEqual({
        phase: "verifying",
      });
      expect(polled).toEqual(observed);
      expect(after).toEqual(before);
    }
  );
  itWithRelease("answers a stored failure without writing", async (release) => {
    const t = await candidateTest(release);
    await t.mutation(async (ctx) => {
      const stored = await ctx.db.query("contentReleases").unique();
      assert(stored, "Expected proof release.");
      await ctx.db.patch("contentReleases", stored._id, {
        proofFailure: "failed",
        status: "verifying",
      });
    });
    const { after, before, observed, polled } = await observePoll(t, release);
    expect(observed).toEqual({
      phase: "failed",
      reason: "failed",
    });
    expect(polled).toEqual(observed);
    expect(after).toEqual(before);
  });
  itWithRelease(
    "reports pending exactly where the poll starts a proof workflow",
    async (release) => {
      vi.useFakeTimers();
      const t = await candidateTest(release);
      const { after, before, observed, polled } = await observePoll(t, release);
      expect(observed).toEqual({
        phase: "pending",
      });
      expect(polled).toEqual({
        phase: "verifying",
      });
      expect(before).not.toHaveProperty("proofWorkflowId");
      expect(after).toMatchObject({
        proofWorkflowId: expect.any(String),
        status: "verifying",
      });
    }
  );
  itWithRelease(
    "reports pending exactly where the poll finalizes a completed workflow",
    async (release) => {
      vi.spyOn(workflow, "status").mockResolvedValue({
        type: "completed",
        result: null,
      });
      vi.spyOn(workflow, "cleanup").mockResolvedValue(true);
      const t = await candidateTest(release);
      await recomputeContentProof(t, release.manifestHash, releaseId);
      const { after, before, observed, polled } = await observePoll(t, release);
      expect(observed).toEqual({
        phase: "pending",
      });
      expect(polled).toEqual({
        phase: "verified",
        proofJson: expect.any(String),
      });
      expect(before).toMatchObject({
        status: "verifying",
      });
      expect(after).toMatchObject({
        status: "verified",
      });
    }
  );
  itWithRelease(
    "reports pending exactly where the poll settles a canceled workflow",
    async (release) => {
      vi.useFakeTimers();
      const t = await candidateTest(release);
      await pollProof(t, release.manifestHash);
      const started = await t.query((ctx) =>
        Effect.runPromise(
          loadRelease(releaseId).pipe(
            Effect.provide(ConfectDatabaseReader.layer(confectSchema, ctx.db))
          )
        )
      );
      const workflowId = started?.proofWorkflowId;
      assert(workflowId, "Expected proof workflow.");
      await t.mutation((ctx) => workflow.cancel(ctx, workflowId));
      const { after, before, observed, polled } = await observePoll(t, release);
      expect(observed).toEqual({
        phase: "pending",
      });
      expect(polled).toEqual({
        phase: "failed",
        reason: "canceled",
      });
      expect(before).toMatchObject({
        status: "verifying",
      });
      expect(after).toMatchObject({
        proofFailure: "canceled",
        status: "verifying",
      });
      expect(after).not.toHaveProperty("proofWorkflowId");
    }
  );
});
