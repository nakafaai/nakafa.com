// @vitest-environment node

import {
  ContentKeySchema,
  ReleaseIdSchema,
} from "@nakafa/aksara-contracts/ids";
import {
  ContentReleaseItemSchema,
  ContentReleaseManifestSchema,
} from "@nakafa/aksara-contracts/release";
import { digestItems } from "@nakafa/aksara-contracts/release/digest";
import {
  canonicalizeRollbackSnapshotEntry,
  RollbackSnapshotEntrySchema,
} from "@nakafa/aksara-contracts/release/rollback";
import { digestRollbackSnapshot } from "@nakafa/aksara-contracts/release/rollback-digest";
import { ContentVerificationKeyResolver } from "@nakafa/aksara-contracts/signature/spec";
import { contentKeyResolver } from "@repo/backend/content/trust";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { recomputeProgram } from "@repo/backend/convex/contentRelease/proof/verify";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  TEST_KEY_RESOLVER,
  TEST_PROOF_RENDERER,
  testEmptyManifest,
  testProofRenderer,
  testSignedRelease,
} from "@repo/backend/test/content-proof";
import { convexTest, type TestConvex } from "convex-test";
import { Effect, Stream } from "effect";
import { describe, expect, it } from "vitest";

const releaseId = ReleaseIdSchema.make("release-proof");
const manifest = testEmptyManifest(releaseId);
const signedRelease = testSignedRelease(manifest);
const manifestHash = signedRelease.manifestHash;

/** Runs one proof through the same Node action boundary as production. */
function runProof(
  t: TestConvex<typeof schema>,
  hash = manifestHash,
  resolver = TEST_KEY_RESOLVER
) {
  return t.action((ctx) =>
    Effect.runPromise(
      recomputeProgram(ctx, hash, releaseId).pipe(
        Effect.provideService(ContentVerificationKeyResolver, resolver)
      )
    )
  );
}

/** Inserts one empty but fully authenticated staged release. */
async function insertRelease(ctx: MutationCtx) {
  const now = Date.UTC(2026, 6, 22, 12, 0, 0);
  await ctx.db.insert("contentReleases", {
    baseFamilies: [],
    checkedIndex: -1,
    checkedItems: 0,
    createdAt: now,
    releaseId,
    releaseJson: JSON.stringify(signedRelease),
    rendererJson: JSON.stringify(TEST_PROOF_RENDERER),
    resultFamilies: [...signedRelease.manifest.scope.families],
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
    status: "staging",
    updatedAt: now,
  });
  await ctx.db.insert("contentState", {
    candidateManifestHash: manifestHash,
    candidateReleaseId: releaseId,
    candidateSequence: 1,
    key: "primary",
    nextSequence: 2,
    updatedAt: now,
  });
}

/** Inserts a multi-page authenticated delete-only release. */
async function insertDeleteRelease(ctx: MutationCtx, count: number) {
  const items = Array.from({ length: count }, (_, index) =>
    ContentReleaseItemSchema.make({
      change: {
        contentKey: ContentKeySchema.make(`test:proof-${index}`),
        family: "material",
        locale: "en",
        operation: "delete",
      },
      index,
      releaseId,
    })
  );
  const digest = Effect.runSync(
    digestItems(releaseId, Stream.fromIterable(items))
  );
  const rollbackEntries = items.map((item) =>
    RollbackSnapshotEntrySchema.make({
      index: item.index,
      releaseId,
      snapshot: {
        contentKey: item.change.contentKey,
        family: item.change.family,
        locale: item.change.locale,
        state: "absent",
      },
    })
  );
  const rollback = Effect.runSync(
    digestRollbackSnapshot(releaseId, Stream.fromIterable(rollbackEntries))
  );
  const nextManifest = ContentReleaseManifestSchema.make({
    ...manifest,
    deleteCount: count,
    itemCount: count,
    itemsDigest: digest.digest,
    rollbackCount: count,
    rollbackDigest: rollback.digest,
    upsertCount: 0,
  });
  const signed = testSignedRelease(nextManifest);
  const now = Date.UTC(2026, 6, 22, 12, 0, 0);
  await ctx.db.insert("contentReleases", {
    baseFamilies: [],
    checkedIndex: -1,
    checkedItems: 0,
    createdAt: now,
    releaseId,
    releaseJson: JSON.stringify(signed),
    rendererJson: JSON.stringify(TEST_PROOF_RENDERER),
    resultFamilies: [...signed.manifest.scope.families],
    role: "candidate",
    sequence: 1,
    stagedArtifacts: 0,
    stagedDeletes: count,
    stagedItems: count,
    stagedProjections: 0,
    stagedRoutes: 0,
    stagedSnapshotBatches: 0,
    stagedSnapshotRows: 0,
    stagedUpserts: 0,
    status: "staging",
    updatedAt: now,
  });
  await ctx.db.insert("contentState", {
    candidateManifestHash: signed.manifestHash,
    candidateReleaseId: releaseId,
    candidateSequence: 1,
    key: "primary",
    nextSequence: 2,
    updatedAt: now,
  });
  for (const [index, item] of items.entries()) {
    const rollbackEntry = rollbackEntries[index];
    if (!rollbackEntry) {
      throw new Error(`Expected rollback entry ${index}.`);
    }
    await ctx.db.insert("contentItems", {
      artifactReady: false,
      contentKey: item.change.contentKey,
      index: item.index,
      itemBatchHash: digest.digest,
      itemBatchIndex: Math.floor(item.index / 4),
      itemJson: JSON.stringify(item),
      locale: item.change.locale,
      projectionReady: false,
      releaseId,
      rollbackJson: canonicalizeRollbackSnapshotEntry(rollbackEntry),
      sequence: 1,
      stagedAt: now,
    });
  }
  return signed.manifestHash;
}

describe("contentRelease/proof/verify", () => {
  it("recomputes an authenticated empty proof and commits it exactly once", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(insertRelease);

    const proof = await runProof(t);
    const release = await t.run((ctx) =>
      ctx.db.query("contentReleases").unique()
    );

    expect(proof).toMatchObject({
      itemCount: 0,
      manifestHash,
      releaseId,
      stagedArtifacts: 0,
    });
    expect(release).toMatchObject({
      checkedItems: 0,
      status: "verified",
    });
  });

  it("fails closed when no production key has been reviewed", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(insertRelease);

    await expect(runProof(t, manifestHash, contentKeyResolver)).rejects.toThrow(
      "Content release verification failed with SigningKeyNotFoundError."
    );
  });

  it("recovers stable internal failures into the typed channel", async () => {
    const t = convexTest(schema, convexModules);

    const result = await t.action((ctx) =>
      Effect.runPromise(
        recomputeProgram(ctx, manifestHash, releaseId).pipe(
          Effect.match({
            onFailure: (error) => ({ code: error.code, tag: error._tag }),
            onSuccess: () => ({ code: null, tag: null }),
          }),
          Effect.provideService(
            ContentVerificationKeyResolver,
            TEST_KEY_RESOLVER
          )
        )
      )
    );

    expect(result).toEqual({
      code: "CONTENT_RELEASE_MISSING",
      tag: "ReleaseError",
    });
  });

  it("replays multi-page item and proof streams before committing", async () => {
    const t = convexTest(schema, convexModules);
    const hash = await t.mutation((ctx) => insertDeleteRelease(ctx, 9));

    const proof = await runProof(t, hash);
    expect(proof).toMatchObject({
      deleteHeads: 9,
      itemCount: 9,
      stagedArtifacts: 0,
      upsertHeads: 0,
    });
  });

  it("rejects renderer and durable counter drift", async () => {
    const rendererDrift = convexTest(schema, convexModules);
    await rendererDrift.mutation(insertRelease);
    const changedRenderer = testProofRenderer("h1");
    await rendererDrift.mutation(async (ctx) => {
      const release = await ctx.db.query("contentReleases").unique();
      if (!release) {
        throw new Error("Expected proof release.");
      }
      await ctx.db.patch("contentReleases", release._id, {
        rendererJson: JSON.stringify(changedRenderer),
      });
    });
    await expect(runProof(rendererDrift)).rejects.toThrow(
      "no longer matches its frozen renderer"
    );

    const counters = convexTest(schema, convexModules);
    await counters.mutation(insertRelease);
    await counters.mutation(async (ctx) => {
      const release = await ctx.db.query("contentReleases").unique();
      if (!release) {
        throw new Error("Expected proof release.");
      }
      await ctx.db.patch("contentReleases", release._id, {
        stagedItems: 1,
        status: "verifying",
      });
    });
    await expect(runProof(counters)).rejects.toThrow("lost durable progress");
  });
});
