// @vitest-environment node

import {
  Ed25519SignatureSchema,
  ReleaseIdSchema,
} from "@nakafa/aksara-contracts/ids";
import { ContentVerificationKeyResolver } from "@nakafa/aksara-contracts/signature/spec";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { advancePublication } from "@repo/backend/convex/contentRelease/ingress/lifecycle";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  TEST_KEY_RESOLVER,
  TEST_PROOF_RENDERER,
  testEmptyManifest,
  testProofRenderer,
  testSignedRelease,
} from "@repo/backend/test/content-proof";
import { convexTest } from "convex-test";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

const releaseId = ReleaseIdSchema.make("release-lifecycle-ingress");
const release = testSignedRelease(testEmptyManifest(releaseId));

/** Inserts one verified release with explicit frozen renderer bytes. */
async function insertRelease(ctx: MutationCtx, rendererJson: string) {
  const now = Date.UTC(2026, 6, 22, 12, 0, 0);
  await ctx.db.insert("contentReleases", {
    checkedIndex: -1,
    checkedItems: 0,
    createdAt: now,
    proofAt: now,
    proofJson: "{}",
    releaseId,
    releaseJson: JSON.stringify(release),
    rendererJson,
    role: "candidate",
    sequence: 1,
    stagedArtifacts: 0,
    stagedDeletes: 0,
    stagedItems: 0,
    stagedProjections: 0,
    stagedRoutes: 0,
    stagedSnapshotBatches: 0,
    stagedSnapshotRows: 0,
    stagedUpserts: 0,
    status: "verified",
    updatedAt: now,
    verifiedAt: now,
  });
  await ctx.db.insert("contentState", {
    candidateManifestHash: release.manifestHash,
    candidateReleaseId: releaseId,
    candidateSequence: 1,
    key: "primary",
    nextSequence: 2,
    updatedAt: now,
  });
}

/** Runs one lifecycle program through the explicit technical verification key. */
function runLifecycle<A, E>(
  program: Effect.Effect<A, E, ContentVerificationKeyResolver>
) {
  return Effect.runPromise(
    program.pipe(
      Effect.provideService(ContentVerificationKeyResolver, TEST_KEY_RESOLVER)
    )
  );
}

describe("content release lifecycle ingress", () => {
  it("aborts through the server-owned cursor and returns exact evidence", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation((ctx) =>
      insertRelease(ctx, JSON.stringify(TEST_PROOF_RENDERER))
    );

    await expect(
      t.action((ctx) =>
        runLifecycle(advancePublication(ctx, { operation: "abort", releaseId }))
      )
    ).resolves.toEqual({
      ok: true,
      operation: "abort",
      value: {
        complete: true,
        processedItems: 0,
        releaseId,
        totalItems: 0,
      },
    });
  });

  it("rejects activation when the frozen renderer identity drifted", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation((ctx) =>
      insertRelease(ctx, JSON.stringify(testProofRenderer("h1")))
    );

    await expect(
      t.action((ctx) =>
        runLifecycle(
          advancePublication(ctx, { operation: "activate", release })
        )
      )
    ).rejects.toThrow("Lifecycle renderer does not match the signed release");
  });

  it("rejects a tampered release before any lifecycle read", async () => {
    const t = convexTest(schema, convexModules);
    const prefix = release.signature.startsWith("A") ? "B" : "A";
    const tampered = {
      ...release,
      signature: Ed25519SignatureSchema.make(
        `${prefix}${release.signature.slice(1)}`
      ),
    };

    await expect(
      t.action((ctx) =>
        runLifecycle(
          advancePublication(ctx, { operation: "verify", release: tampered })
        )
      )
    ).rejects.toThrow("Content release verification failed");
  });
});
