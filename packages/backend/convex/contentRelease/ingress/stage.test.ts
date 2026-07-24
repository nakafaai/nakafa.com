// @vitest-environment node

import {
  Ed25519SignatureSchema,
  ReleaseIdSchema,
  Sha256HashSchema,
} from "@nakafa/aksara-contracts/ids";
import { ProgramSnapshotSchema } from "@nakafa/aksara-contracts/program/snapshot";
import { ContentReleaseManifestSchema } from "@nakafa/aksara-contracts/release";
import type {
  ContentSnapshotManifest,
  ContentSnapshotRow,
} from "@nakafa/aksara-contracts/release/snapshot-data";
import { ContentVerificationKeyResolver } from "@nakafa/aksara-contracts/signature/spec";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { stagePublication } from "@repo/backend/convex/contentRelease/ingress/stage";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  TEST_KEY_ID,
  TEST_KEY_RESOLVER,
  TEST_PROOF_RENDERER,
  testEmptyManifest,
  testProofRenderer,
  testSignedArtifact,
  testSignedRelease,
} from "@repo/backend/test/content-proof";
import {
  makeProgramSnapshotData,
  type ProgramSnapshotData,
} from "@repo/backend/test/content-snapshot";
import { convexTest } from "convex-test";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

const candidateId = ReleaseIdSchema.make("release-stage-candidate");

/** Creates one signed empty release bound to the technical renderer. */
function signedRelease(releaseId = candidateId) {
  return testSignedRelease(testEmptyManifest(releaseId));
}

/** Signs one candidate that replaces the complete technical program snapshot. */
function snapshotRelease(snapshots: ProgramSnapshotData["snapshots"]) {
  return testSignedRelease(
    ContentReleaseManifestSchema.make({
      ...testEmptyManifest(candidateId),
      snapshots,
    })
  );
}

/** Inserts one pending row with explicit frozen envelope bytes. */
async function insertCandidate(
  ctx: MutationCtx,
  release: ReturnType<typeof signedRelease>,
  rendererJson = JSON.stringify(TEST_PROOF_RENDERER)
) {
  const now = Date.UTC(2026, 6, 22, 12, 0, 0);
  await ctx.db.insert("contentReleases", {
    checkedIndex: -1,
    checkedItems: 0,
    createdAt: now,
    releaseId: candidateId,
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
    status: "staging",
    updatedAt: now,
  });
  await ctx.db.insert("contentState", {
    candidateManifestHash: release.manifestHash,
    candidateReleaseId: candidateId,
    candidateSequence: 1,
    key: "primary",
    nextSequence: 2,
    updatedAt: now,
  });
}

describe("content release staging ingress", () => {
  it("rejects a renderer not owned by the signed release", async () => {
    const t = convexTest(schema, convexModules);

    await expect(
      t.action((ctx) =>
        Effect.runPromise(
          stagePublication(
            ctx,
            {
              operation: "stageRelease",
              release: signedRelease(),
              rendererManifest: testProofRenderer("h1"),
            },
            TEST_KEY_ID
          ).pipe(
            Effect.provideService(
              ContentVerificationKeyResolver,
              TEST_KEY_RESOLVER
            )
          )
        )
      )
    ).rejects.toThrow("does not own the supplied renderer snapshot");
  });

  it("rejects a stored candidate whose signed identity drifted", async () => {
    const t = convexTest(schema, convexModules);
    const other = signedRelease(ReleaseIdSchema.make("release-stage-other"));
    await t.mutation((ctx) => insertCandidate(ctx, other));

    await expect(
      t.action((ctx) =>
        Effect.runPromise(
          stagePublication(
            ctx,
            {
              artifacts: [testSignedArtifact()],
              batchIndex: 0,
              operation: "stageArtifactBatch",
              releaseId: candidateId,
            },
            TEST_KEY_ID
          ).pipe(
            Effect.provideService(
              ContentVerificationKeyResolver,
              TEST_KEY_RESOLVER
            )
          )
        )
      )
    ).rejects.toThrow("identity does not match its stored envelope");
  });

  it("rejects a tampered artifact before storage", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation((ctx) => insertCandidate(ctx, signedRelease()));
    const artifact = testSignedArtifact();
    const prefix = artifact.signature.startsWith("A") ? "B" : "A";
    const tampered = {
      ...artifact,
      signature: Ed25519SignatureSchema.make(
        `${prefix}${artifact.signature.slice(1)}`
      ),
    };

    await expect(
      t.action((ctx) =>
        Effect.runPromise(
          stagePublication(
            ctx,
            {
              artifacts: [tampered],
              batchIndex: 0,
              operation: "stageArtifactBatch",
              releaseId: candidateId,
            },
            TEST_KEY_ID
          ).pipe(
            Effect.provideService(
              ContentVerificationKeyResolver,
              TEST_KEY_RESOLVER
            )
          )
        )
      )
    ).rejects.toThrow("Content release verification failed");
  });

  it("rejects a poisoned manifest before storage and accepts its exact retry", async () => {
    const data = await Effect.runPromise(makeProgramSnapshotData());
    const release = snapshotRelease(data.snapshots);
    const t = convexTest(schema, convexModules);
    await t.mutation((ctx) => insertCandidate(ctx, release));
    const tampered: ContentSnapshotManifest = {
      family: "program",
      manifest: ProgramSnapshotSchema.make({
        ...data.snapshot.manifest,
        rowDigest: Sha256HashSchema.make(`sha256:${"9".repeat(64)}`),
      }),
    };

    await expect(
      t.action((ctx) =>
        Effect.runPromise(
          stagePublication(ctx, {
            operation: "stageSnapshot",
            releaseId: candidateId,
            snapshot: tampered,
          }).pipe(
            Effect.provideService(
              ContentVerificationKeyResolver,
              TEST_KEY_RESOLVER
            )
          )
        )
      )
    ).rejects.toThrow("invalid content identity");
    await expect(
      t.run((ctx) => ctx.db.query("contentSnapshots").unique())
    ).resolves.toBeNull();
    await expect(
      t.action((ctx) =>
        Effect.runPromise(
          stagePublication(ctx, {
            operation: "stageSnapshot",
            releaseId: candidateId,
            snapshot: data.snapshot,
          }).pipe(
            Effect.provideService(
              ContentVerificationKeyResolver,
              TEST_KEY_RESOLVER
            )
          )
        )
      )
    ).resolves.toMatchObject({
      ok: true,
      operation: "stageSnapshot",
      value: { created: 1, snapshotId: data.snapshotId },
    });
  });

  it("rejects poisoned rows before storage and accepts the exact batch retry", async () => {
    const data = await Effect.runPromise(makeProgramSnapshotData());
    const [firstRow, ...remainingRows] = data.rows;
    if (firstRow?.family !== "program") {
      throw new Error("Expected one program snapshot row.");
    }
    const tampered: ContentSnapshotRow = {
      ...firstRow,
      record: {
        ...firstRow.record,
        rowHash: Sha256HashSchema.make(`sha256:${"9".repeat(64)}`),
      },
    };
    const release = snapshotRelease(data.snapshots);
    const t = convexTest(schema, convexModules);
    await t.mutation((ctx) => insertCandidate(ctx, release));
    await t.action((ctx) =>
      Effect.runPromise(
        stagePublication(ctx, {
          operation: "stageSnapshot",
          releaseId: candidateId,
          snapshot: data.snapshot,
        }).pipe(
          Effect.provideService(
            ContentVerificationKeyResolver,
            TEST_KEY_RESOLVER
          )
        )
      )
    );

    await expect(
      t.action((ctx) =>
        Effect.runPromise(
          stagePublication(ctx, {
            batchIndex: 0,
            family: "program",
            operation: "stageSnapshotBatch",
            releaseId: candidateId,
            rows: [tampered],
            snapshotId: data.snapshotId,
          }).pipe(
            Effect.provideService(
              ContentVerificationKeyResolver,
              TEST_KEY_RESOLVER
            )
          )
        )
      )
    ).rejects.toThrow("invalid content identity");
    await expect(
      t.run(async (ctx) => ({
        batches: await ctx.db.query("snapshotBatches").collect(),
        rows: await ctx.db.query("programRows").collect(),
      }))
    ).resolves.toEqual({ batches: [], rows: [] });
    await expect(
      t.action((ctx) =>
        Effect.runPromise(
          stagePublication(ctx, {
            batchIndex: 0,
            family: "program",
            operation: "stageSnapshotBatch",
            releaseId: candidateId,
            rows: [firstRow, ...remainingRows],
            snapshotId: data.snapshotId,
          }).pipe(
            Effect.provideService(
              ContentVerificationKeyResolver,
              TEST_KEY_RESOLVER
            )
          )
        )
      )
    ).resolves.toMatchObject({
      ok: true,
      operation: "stageSnapshotBatch",
      value: {
        batchIndex: 0,
        family: "program",
        snapshotId: data.snapshotId,
      },
    });
  });
});
