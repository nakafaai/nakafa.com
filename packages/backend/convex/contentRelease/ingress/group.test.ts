// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { ReleaseIdSchema } from "@nakafa/aksara-contracts/ids";
import { ContentReleaseManifestSchema } from "@nakafa/aksara-contracts/release";
import { ContentVerificationKeyResolver } from "@nakafa/aksara-contracts/signature/spec";
import { StageGroupRequestSchema } from "@nakafa/aksara-contracts/transport/group";
import { stagePublicationGroup } from "@repo/backend/convex/contentRelease/ingress/group";
import { stagePublication } from "@repo/backend/convex/contentRelease/ingress/stage";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  TEST_KEY_ID,
  TEST_KEY_RESOLVER,
  TEST_PROOF_RENDERER,
  testEmptyManifest,
  testSignedRelease,
} from "@repo/backend/test/content/proof";
import { testPublicationScope } from "@repo/backend/test/content/release";
import { insertSignedCandidate } from "@repo/backend/test/content/stage";
import { makeProgramSnapshotData } from "@repo/backend/test/program/snapshot";
import { convexTest } from "convex-test";
import { Effect, Schema } from "effect";

const releaseId = ReleaseIdSchema.make("release-stage-group");

describe("content release staging groups", () => {
  it("resumes a committed prefix and retries the complete group", async () => {
    const data = await Effect.runPromise(makeProgramSnapshotData());
    const firstRow = data.rows[0];
    if (!firstRow) {
      throw new Error("Expected one program snapshot row.");
    }
    const release = testSignedRelease(
      ContentReleaseManifestSchema.make({
        ...testEmptyManifest(releaseId),
        scope: testPublicationScope({ snapshots: data.snapshots }),
        snapshots: data.snapshots,
      })
    );
    const request = Schema.decodeSync(StageGroupRequestSchema)({
      operation: "stageGroup",
      releaseId,
      requests: [
        {
          operation: "stageSnapshot",
          releaseId,
          snapshot: data.snapshot,
        },
        {
          batchIndex: 0,
          family: "program",
          operation: "stageSnapshotBatch",
          releaseId,
          rows: [firstRow],
          snapshotId: data.snapshotId,
        },
      ],
    });
    const t = convexTest(schema, convexModules);
    await t.mutation((ctx) =>
      insertSignedCandidate(
        ctx,
        releaseId,
        release,
        JSON.stringify(TEST_PROOF_RENDERER)
      )
    );

    const firstRequest = request.requests[0];
    await t.action((ctx) =>
      Effect.runPromise(
        stagePublication(ctx, firstRequest, TEST_KEY_ID).pipe(
          Effect.provideService(
            ContentVerificationKeyResolver,
            TEST_KEY_RESOLVER
          )
        )
      )
    );

    /** Executes the same authenticated group against the durable test store. */
    const run = () =>
      t.action((ctx) =>
        Effect.runPromise(
          stagePublicationGroup(ctx, request, TEST_KEY_ID).pipe(
            Effect.provideService(
              ContentVerificationKeyResolver,
              TEST_KEY_RESOLVER
            )
          )
        )
      );
    await expect(run()).resolves.toEqual({
      ok: true,
      operation: "stageGroup",
      value: { releaseId, requestCount: 2 },
    });
    await expect(run()).resolves.toMatchObject({ ok: true });
    await expect(
      t.run(async (ctx) => ({
        batches: await ctx.db.query("snapshotBatches").collect(),
        snapshots: await ctx.db.query("contentSnapshots").collect(),
      }))
    ).resolves.toMatchObject({
      batches: [expect.objectContaining({ batchIndex: 0 })],
      snapshots: [expect.objectContaining({ family: "program" })],
    });
  });
});
