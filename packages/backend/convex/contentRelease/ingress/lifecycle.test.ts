// @vitest-environment node

import {
  Ed25519SignatureSchema,
  ReleaseIdSchema,
} from "@nakafa/aksara-contracts/ids";
import {
  ContentReleaseManifestSchema,
  RollbackSignedContentReleaseSchema,
  type SignedContentRelease,
} from "@nakafa/aksara-contracts/release";
import { PublicationScopeSchema } from "@nakafa/aksara-contracts/release/snapshot/spec";
import { ContentVerificationKeyResolver } from "@nakafa/aksara-contracts/signature/spec";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { advancePublication } from "@repo/backend/convex/contentRelease/ingress/lifecycle";
import { encodeRendererJson } from "@repo/backend/convex/contentRelease/wire";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  TEST_KEY_RESOLVER,
  TEST_PROOF_RENDERER,
  testEmptyManifest,
  testProofRenderer,
  testSignedRelease,
} from "@repo/backend/test/content-proof";
import { insertSignedCandidate } from "@repo/backend/test/content-stage";
import {
  insertTestState,
  insertZeroRelease,
} from "@repo/backend/test/content-state";
import { completeContentProof } from "@repo/backend/test/content-verify";
import { convexTest } from "convex-test";
import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";

vi.mock("@repo/backend/content/trust", async () => {
  const { TEST_KEY_RESOLVER } = await import(
    "@repo/backend/test/content-proof"
  );
  return { contentKeyResolver: TEST_KEY_RESOLVER };
});

const releaseId = ReleaseIdSchema.make("release-lifecycle-ingress");
const release = testSignedRelease(testEmptyManifest(releaseId));
const recoveryReleaseId = ReleaseIdSchema.make(
  "release-lifecycle-ingress-recovery"
);

/** Inserts one verified release with explicit frozen renderer bytes. */
async function insertRelease(ctx: MutationCtx, rendererJson: string) {
  const now = Date.UTC(2026, 6, 22, 12, 0, 0);
  await ctx.db.insert("contentReleases", {
    baseFamilies: [],
    checkedIndex: -1,
    checkedItems: 0,
    createdAt: now,
    proofAt: now,
    proofJson: "{}",
    releaseId,
    releaseJson: JSON.stringify(release),
    rendererJson,
    resultFamilies: [...release.manifest.scope.families],
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

/** Inserts one authenticated zero-impact candidate and its exact inverse. */
async function insertActivationPair(
  ctx: MutationCtx,
  candidate: SignedContentRelease,
  recovery: SignedContentRelease
) {
  const candidateIdentity = {
    manifestHash: candidate.manifestHash,
    releaseId: candidate.manifest.releaseId,
    sequence: 1,
  };
  const recoveryIdentity = {
    manifestHash: recovery.manifestHash,
    releaseId: recovery.manifest.releaseId,
    sequence: 2,
  };
  await insertZeroRelease(ctx, {
    ...candidateIdentity,
    ownership: { base: [], result: [] },
    role: "candidate",
    scope: candidate.manifest.scope,
    snapshots: candidate.manifest.snapshots,
    status: "verified",
  });
  await insertZeroRelease(ctx, {
    ...recoveryIdentity,
    base: candidateIdentity,
    originReleaseId: candidate.manifest.releaseId,
    ownership: { base: [], result: [] },
    role: "recovery",
    scope: recovery.manifest.scope,
    snapshots: recovery.manifest.snapshots,
    status: "verified",
  });
  const rendererJson = encodeRendererJson(TEST_PROOF_RENDERER);
  const releases = await ctx.db.query("contentReleases").collect();
  for (const stored of releases) {
    const signed =
      stored.releaseId === candidate.manifest.releaseId ? candidate : recovery;
    await ctx.db.patch("contentReleases", stored._id, {
      releaseJson: JSON.stringify(signed),
      rendererJson,
    });
  }
  await insertTestState(ctx, {
    candidate: candidateIdentity,
    nextSequence: 3,
    recovery: recoveryIdentity,
  });
}

/** Creates signed zero-impact manifests that complete read models immediately. */
function makeActivationPair() {
  const scope = PublicationScopeSchema.make({
    content: [],
    families: ["page"],
    snapshots: [],
  });
  const candidateManifest = ContentReleaseManifestSchema.make({
    ...testEmptyManifest(releaseId),
    scope,
  });
  const candidate = testSignedRelease(candidateManifest);
  const recoveryManifest = ContentReleaseManifestSchema.make({
    ...testEmptyManifest(recoveryReleaseId),
    baseActiveAppLocales: candidateManifest.activeAppLocales,
    baseManifestHash: candidate.manifestHash,
    baseReleaseId: releaseId,
    origin: { kind: "rollback", releaseId },
    scope,
  });
  return {
    candidate,
    recovery: RollbackSignedContentReleaseSchema.make(
      testSignedRelease(recoveryManifest)
    ),
  };
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
  it("returns authenticated evidence after durable proof completion", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation((ctx) =>
      insertSignedCandidate(
        ctx,
        releaseId,
        release,
        JSON.stringify(TEST_PROOF_RENDERER)
      )
    );

    await completeContentProof(t, release.manifestHash, releaseId);
    await expect(
      t.action((ctx) =>
        runLifecycle(advancePublication(ctx, { operation: "verify", release }))
      )
    ).resolves.toMatchObject({
      ok: true,
      operation: "verify",
      value: {
        evidence: {
          manifestHash: release.manifestHash,
          releaseId,
        },
        phase: "verified",
      },
    });
  });

  it("surfaces only the stable terminal proof category", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation((ctx) =>
      insertSignedCandidate(
        ctx,
        releaseId,
        release,
        JSON.stringify(TEST_PROOF_RENDERER)
      )
    );
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

    await expect(
      t.action((ctx) =>
        runLifecycle(advancePublication(ctx, { operation: "verify", release }))
      )
    ).rejects.toThrow(`Content release ${releaseId} proof workflow failed.`);
  });

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

  it("keeps the external activation receipt unchanged", async () => {
    const t = convexTest(schema, convexModules);
    const pair = makeActivationPair();
    await t.mutation((ctx) =>
      insertActivationPair(ctx, pair.candidate, pair.recovery)
    );

    const activated = await t.action((ctx) =>
      runLifecycle(
        advancePublication(ctx, {
          operation: "activate",
          release: pair.candidate,
        })
      )
    );
    const repeated = await t.action((ctx) =>
      runLifecycle(
        advancePublication(ctx, {
          operation: "activate",
          release: pair.candidate,
        })
      )
    );

    expect(activated).toEqual(repeated);
    expect(activated).toMatchObject({
      ok: true,
      operation: "activate",
      value: {
        manifestHash: pair.candidate.manifestHash,
        releaseId,
      },
    });
    expect(activated.value).not.toHaveProperty("kind");
    await expect(
      t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect())
    ).resolves.toEqual([]);

    const recovered = await t.action((ctx) =>
      runLifecycle(
        advancePublication(ctx, {
          operation: "activateRecovery",
          release: pair.recovery,
        })
      )
    );
    expect(recovered).toMatchObject({
      ok: true,
      operation: "activateRecovery",
      value: {
        manifestHash: pair.recovery.manifestHash,
        releaseId: recoveryReleaseId,
      },
    });
    expect(recovered.value).not.toHaveProperty("kind");
    const repeatedRecovery = await t.action((ctx) =>
      runLifecycle(
        advancePublication(ctx, {
          operation: "activateRecovery",
          release: pair.recovery,
        })
      )
    );
    expect(repeatedRecovery).toEqual(recovered);
    await expect(
      t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect())
    ).resolves.toEqual([]);
  });
});
