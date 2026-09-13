// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { ReleaseIdSchema } from "@nakafa/aksara-contracts/ids";
import {
  ContentReleaseManifestSchema,
  ReleaseVerificationEvidenceSchema,
} from "@nakafa/aksara-contracts/release";
import { internal } from "@repo/backend/convex/_generated/api";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { ROLLBACK_RETENTION_MS } from "@repo/backend/convex/contentRelease/spec";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  TEST_PROOF_RENDERER,
  testEmptyManifest,
  testSignedRelease,
} from "@repo/backend/test/content/proof";
import { testPublicationScope } from "@repo/backend/test/content/release";
import { insertSignedCandidate } from "@repo/backend/test/content/stage";
import { recomputeContentProof } from "@repo/backend/test/content/verify";
import { makeProgramSnapshotData } from "@repo/backend/test/program/snapshot";
import { convexTest } from "convex-test";
import { Effect } from "effect";

const releaseId = ReleaseIdSchema.make("release-proof-commit");
const release = testSignedRelease(testEmptyManifest(releaseId));
const commit = internal.contentRelease.proof.commit.commitProof;

/** Obtains authentic proof bytes through the same verifier used by production. */
async function prepare() {
  const t = convexTest(schema, convexModules);
  await t.mutation((ctx) =>
    insertSignedCandidate(
      ctx,
      releaseId,
      release,
      JSON.stringify(TEST_PROOF_RENDERER)
    )
  );
  const proof = await recomputeContentProof(t, release.manifestHash, releaseId);
  return { proof, proofJson: JSON.stringify(proof), t };
}

/** Selects the unique technical release for deliberate durability corruption. */
async function storedRelease(ctx: MutationCtx) {
  const row = await ctx.db.query("contentReleases").unique();
  if (!row) {
    throw new Error("Expected the staged proof fixture.");
  }
  return row;
}

describe("durable proof commit", () => {
  it("replays exact proof bytes without rewriting the original timestamp", async () => {
    const { t, proofJson } = await prepare();
    const before = await t.run(storedRelease);
    await expect(t.mutation(commit, { proofJson })).resolves.toMatchObject({
      phase: "verifying",
    });
    await t.mutation(async (ctx) => {
      const row = await storedRelease(ctx);
      await ctx.db.patch("contentReleases", row._id, {
        status: "verified",
        verifiedAt: 10,
      });
    });
    await expect(t.mutation(commit, { proofJson })).resolves.toMatchObject({
      phase: "verified",
    });
    const after = await t.run(storedRelease);
    expect(after.proofAt).toBe(before.proofAt);
    expect(after.proofJson).toBe(before.proofJson);
  });

  it.each(["different bytes", "missing timestamp"] as const)(
    "rejects an existing proof with %s",
    async (corruption) => {
      const { t, proofJson } = await prepare();
      await t.mutation(async (ctx) => {
        const row = await storedRelease(ctx);
        await ctx.db.patch(
          "contentReleases",
          row._id,
          corruption === "different bytes"
            ? { proofJson: `${proofJson} ` }
            : { proofAt: undefined }
        );
      });
      await expect(t.mutation(commit, { proofJson })).rejects.toMatchObject({
        data: { code: "CONTENT_RELEASE_CONFLICT" },
      });
    }
  );

  it.each(["counter", "manifest", "unfrozen"] as const)(
    "rejects a %s change before a new proof is committed",
    async (corruption) => {
      const { t, proof, proofJson } = await prepare();
      await t.mutation(async (ctx) => {
        const row = await storedRelease(ctx);
        await ctx.db.patch("contentReleases", row._id, {
          proofAt: undefined,
          proofJson: undefined,
          ...(corruption === "counter" ? { stagedArtifacts: 1 } : {}),
          ...(corruption === "unfrozen" ? { status: "staging" } : {}),
        });
      });
      const input =
        corruption === "manifest"
          ? JSON.stringify({
              ...proof,
              resultDigest: release.manifest.itemsDigest,
            })
          : proofJson;
      await expect(
        t.mutation(commit, { proofJson: input })
      ).rejects.toMatchObject({
        data: {
          code:
            corruption === "unfrozen"
              ? "CONTENT_RELEASE_STATE"
              : "CONTENT_RELEASE_INTEGRITY",
        },
      });
      expect((await t.run(storedRelease)).proofJson).toBeUndefined();
    }
  );

  it.effect.each(["new", "retained", "missing"] as const)(
    "retains verified replacement snapshots and rejects %s evidence loss",
    (mode) =>
      Effect.gen(function* () {
        const { t, proof } = yield* Effect.promise(() => prepare());
        const data = yield* makeProgramSnapshotData();
        const replacement = testSignedRelease(
          ContentReleaseManifestSchema.make({
            ...release.manifest,
            scope: testPublicationScope({ snapshots: data.snapshots }),
            snapshots: data.snapshots,
          })
        );
        const snapshotProof = ReleaseVerificationEvidenceSchema.make({
          ...proof,
          manifestHash: replacement.manifestHash,
          snapshots: data.snapshots,
          stagedSnapshotRows: data.rowJson.length,
        });
        const retainedUntil = Number.MAX_SAFE_INTEGER;
        yield* Effect.promise(() =>
          t.mutation(async (ctx) => {
            const row = await storedRelease(ctx);
            await ctx.db.patch("contentReleases", row._id, {
              proofAt: undefined,
              proofJson: undefined,
              releaseJson: JSON.stringify(replacement),
              stagedSnapshotRows: data.rowJson.length,
            });
            if (mode !== "missing") {
              await ctx.db.insert("contentSnapshots", {
                createdAt: 1,
                family: "program",
                retainUntil: mode === "retained" ? retainedUntil : 1,
                snapshotId: data.snapshotId,
                snapshotJson: data.manifestJson,
                ...(mode === "retained" ? { verifiedAt: 2 } : {}),
              });
            }
          })
        );
        const action = t.mutation(commit, {
          proofJson: JSON.stringify(snapshotProof),
        });
        if (mode === "missing") {
          yield* Effect.promise(() =>
            expect(action).rejects.toMatchObject({
              data: { code: "CONTENT_RELEASE_MISSING" },
            })
          );
          expect(
            (yield* Effect.promise(() => t.run(storedRelease))).proofJson
          ).toBeUndefined();
          return;
        }
        yield* Effect.promise(() =>
          expect(action).resolves.toMatchObject({ phase: "verifying" })
        );
        const snapshot = yield* Effect.promise(() =>
          t.run((ctx) => ctx.db.query("contentSnapshots").unique())
        );
        const stored = yield* Effect.promise(() => t.run(storedRelease));
        expect(snapshot?.verifiedAt).toBe(
          mode === "retained" ? 2 : stored.proofAt
        );
        expect(snapshot?.retainUntil).toBe(
          mode === "retained"
            ? retainedUntil
            : (stored.proofAt ?? 0) + ROLLBACK_RETENTION_MS
        );
      })
  );
});
