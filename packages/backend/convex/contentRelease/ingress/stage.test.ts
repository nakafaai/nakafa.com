// @vitest-environment node

import { Buffer } from "node:buffer";
import { generateKeyPairSync, sign as signBytes } from "node:crypto";
import { describe, expect, it } from "@effect/vitest";
import {
  Ed25519SignatureSchema,
  ReleaseIdSchema,
  Sha256HashSchema,
  SigningKeyIdSchema,
} from "@nakafa/aksara-contracts/ids";
import { ProgramSnapshotSchema } from "@nakafa/aksara-contracts/program/snapshot/spec";
import {
  ContentReleaseManifestSchema,
  SignedContentReleaseSchema,
} from "@nakafa/aksara-contracts/release";
import { canonicalizeContentReleaseSigningInput } from "@nakafa/aksara-contracts/release/signing";
import type {
  ContentSnapshotManifest,
  ContentSnapshotRow,
} from "@nakafa/aksara-contracts/release/snapshot/data";
import { ContentVerificationKeyResolver } from "@nakafa/aksara-contracts/signature/spec";
import { stagePublication } from "@repo/backend/convex/contentRelease/ingress/stage";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  ingressArtifact,
  ingressItem,
  ingressRelease,
  ingressReleaseId,
} from "@repo/backend/test/content/ingress";
import {
  TEST_KEY_ID,
  TEST_KEY_RESOLVER,
  TEST_PROOF_RENDERER,
  TEST_PUBLIC_KEY,
  testEmptyManifest,
  testProofRenderer,
  testSignedArtifact,
  testSignedRelease,
} from "@repo/backend/test/content/proof";
import { testPublicationScope } from "@repo/backend/test/content/release";
import { insertSignedCandidate } from "@repo/backend/test/content/stage";
import {
  makeProgramSnapshotData,
  type ProgramSnapshotData,
} from "@repo/backend/test/program/snapshot";
import { convexTest } from "convex-test";
import { Effect } from "effect";

const candidateId = ReleaseIdSchema.make("release-stage-candidate");
const activeKeyId = SigningKeyIdSchema.make("test-active-key");
const activeKeys = generateKeyPairSync("ed25519");
const activePublicKey = activeKeys.publicKey
  .export({ format: "pem", type: "spki" })
  .toString();
const rotatedKeyResolver = ContentVerificationKeyResolver.of({
  resolve: (keyId) => {
    if (keyId === activeKeyId) {
      return Effect.succeed(activePublicKey);
    }
    if (keyId === TEST_KEY_ID) {
      return Effect.succeed(TEST_PUBLIC_KEY);
    }
    return TEST_KEY_RESOLVER.resolve(keyId);
  },
});

/** Re-signs the complete ingress manifest under the simulated active key. */
function activeSignedRelease() {
  return SignedContentReleaseSchema.make({
    keyId: activeKeyId,
    manifest: ingressRelease.manifest,
    manifestHash: ingressRelease.manifestHash,
    signature: Ed25519SignatureSchema.make(
      signBytes(
        null,
        Buffer.from(
          canonicalizeContentReleaseSigningInput(
            ingressRelease.manifestHash,
            ingressRelease.manifest
          ),
          "utf8"
        ),
        activeKeys.privateKey
      ).toString("base64url")
    ),
  });
}

/** Creates one signed empty release bound to the technical renderer. */
function signedRelease(releaseId = candidateId) {
  return testSignedRelease(testEmptyManifest(releaseId));
}

/** Signs one candidate that replaces the complete technical program snapshot. */
function snapshotRelease(snapshots: ProgramSnapshotData["snapshots"]) {
  return testSignedRelease(
    ContentReleaseManifestSchema.make({
      ...testEmptyManifest(candidateId),
      scope: testPublicationScope({ snapshots }),
      snapshots,
    })
  );
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
    await t.mutation((ctx) =>
      insertSignedCandidate(
        ctx,
        candidateId,
        other,
        JSON.stringify(TEST_PROOF_RENDERER)
      )
    );

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
    await t.mutation((ctx) =>
      insertSignedCandidate(
        ctx,
        candidateId,
        signedRelease(),
        JSON.stringify(TEST_PROOF_RENDERER)
      )
    );
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

  it("admits retained artifacts only for authenticated recovery rows", async () => {
    for (const role of ["candidate", "recovery"] as const) {
      const t = convexTest(schema, convexModules);
      await t.mutation(async (ctx) => {
        await insertSignedCandidate(
          ctx,
          ingressReleaseId,
          activeSignedRelease(),
          JSON.stringify(TEST_PROOF_RENDERER)
        );
        if (role === "candidate") {
          return;
        }
        const [release, state] = await Promise.all([
          ctx.db.query("contentReleases").unique(),
          ctx.db.query("contentState").unique(),
        ]);
        if (!(release && state)) {
          throw new Error("Expected one staged release and state row.");
        }
        await ctx.db.patch("contentReleases", release._id, { role });
        await ctx.db.patch("contentState", state._id, {
          candidateManifestHash: undefined,
          candidateReleaseId: undefined,
          candidateSequence: undefined,
          recoveryManifestHash: ingressRelease.manifestHash,
          recoveryReleaseId: ingressReleaseId,
          recoverySequence: release.sequence,
        });
      });
      await t.action((ctx) =>
        Effect.runPromise(
          stagePublication(ctx, {
            batchIndex: 0,
            items: [ingressItem],
            operation: "stageItemBatch",
            releaseId: ingressReleaseId,
          }).pipe(
            Effect.provideService(
              ContentVerificationKeyResolver,
              rotatedKeyResolver
            )
          )
        )
      );
      const stageArtifact = t.action((ctx) =>
        Effect.runPromise(
          stagePublication(
            ctx,
            {
              artifacts: [ingressArtifact],
              batchIndex: 0,
              operation: "stageArtifactBatch",
              releaseId: ingressReleaseId,
            },
            activeKeyId
          ).pipe(
            Effect.provideService(
              ContentVerificationKeyResolver,
              rotatedKeyResolver
            )
          )
        )
      );
      if (role === "candidate") {
        await expect(stageArtifact).rejects.toThrow(
          "must use the active content signing key"
        );
        continue;
      }
      await expect(stageArtifact).resolves.toMatchObject({
        ok: true,
        operation: "stageArtifactBatch",
        value: { created: 1, unchanged: 0 },
      });
    }
  });

  it("rejects a poisoned manifest before storage and accepts its exact retry", async () => {
    const data = await Effect.runPromise(makeProgramSnapshotData());
    const release = snapshotRelease(data.snapshots);
    const t = convexTest(schema, convexModules);
    await t.mutation((ctx) =>
      insertSignedCandidate(
        ctx,
        candidateId,
        release,
        JSON.stringify(TEST_PROOF_RENDERER)
      )
    );
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
    await t.mutation((ctx) =>
      insertSignedCandidate(
        ctx,
        candidateId,
        release,
        JSON.stringify(TEST_PROOF_RENDERER)
      )
    );
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
        curriculum: await ctx.db.query("curriculumRoutes").collect(),
        programs: await ctx.db.query("programCatalog").collect(),
      }))
    ).resolves.toEqual({ batches: [], curriculum: [], programs: [] });
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
