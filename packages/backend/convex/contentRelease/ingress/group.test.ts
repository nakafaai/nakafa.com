// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { ReleaseIdSchema } from "@nakafa/aksara-contracts/ids";
import { ContentReleaseManifestSchema } from "@nakafa/aksara-contracts/release";
import { ContentVerificationKeyResolver } from "@nakafa/aksara-contracts/signature/spec";
import { StageGroupRequestSchema } from "@nakafa/aksara-contracts/transport/group";
import { stagePublicationGroup } from "@repo/backend/convex/contentRelease/ingress/group";
import { stagePublication } from "@repo/backend/convex/contentRelease/ingress/stage";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  TEST_KEY_ID,
  TEST_KEY_RESOLVER,
  TEST_PROOF_RENDERER,
  testEmptyManifest,
  testSignedRelease,
} from "@repo/backend/test/content/proof";
import {
  TEST_HISTORICAL_QUESTION_PROJECTION,
  TEST_HISTORICAL_QUESTION_PROJECTION_JSON,
  TEST_QUESTION_CONTENT_KEY,
  TEST_QUESTION_SOURCE,
} from "@repo/backend/test/content/question";
import {
  testPublicationScope,
  testUpsertJson,
} from "@repo/backend/test/content/release";
import {
  insertSignedCandidate,
  insertTestRelease,
} from "@repo/backend/test/content/stage";
import { makeProgramSnapshotData } from "@repo/backend/test/program/snapshot";
import { convexTest } from "convex-test";
import { Data, Effect, Schema } from "effect";

const releaseId = ReleaseIdSchema.make("release-stage-group");

class UnexpectedGroupTestState extends Data.TaggedError(
  "UnexpectedGroupTestState"
)<{
  readonly operation: "select-program-row";
}> {}

describe("content release staging groups", () => {
  it.effect("stages prior Question bytes only through a recovery group", () =>
    Effect.gen(function* () {
      const request = yield* Schema.decodeEffect(StageGroupRequestSchema)({
        operation: "stageGroup",
        releaseId,
        requests: [
          {
            batchIndex: 0,
            items: [
              JSON.parse(
                testUpsertJson({
                  contentKey: TEST_QUESTION_CONTENT_KEY,
                  family: "question",
                  releaseId,
                  rendererDomain: "snbt-general",
                  sourcePath: TEST_QUESTION_SOURCE,
                })
              ),
            ],
            operation: "stageItemBatch",
            releaseId,
          },
          {
            batchIndex: 0,
            operation: "stageRollbackProjectionBatch",
            projections: [TEST_HISTORICAL_QUESTION_PROJECTION],
            releaseId,
          },
        ],
      });
      const t = convexTest(schema, convexModules);
      yield* Effect.promise(() =>
        t.mutation((ctx) =>
          insertTestRelease(ctx, { releaseId, role: "recovery" })
        )
      );

      expect(
        yield* Effect.promise(() =>
          t.action((ctx) =>
            runConvexProgram(
              stagePublicationGroup(ctx, request, TEST_KEY_ID).pipe(
                Effect.provideService(
                  ContentVerificationKeyResolver,
                  TEST_KEY_RESOLVER
                )
              )
            )
          )
        )
      ).toEqual({
        ok: true,
        operation: "stageGroup",
        value: { releaseId, requestCount: 2 },
      });
      expect(
        yield* Effect.promise(() =>
          t.run((ctx) => ctx.db.query("contentItems").unique())
        )
      ).toMatchObject({
        projectionJson: TEST_HISTORICAL_QUESTION_PROJECTION_JSON,
        projectionReady: true,
      });
    })
  );

  it.effect("resumes a committed prefix and retries the complete group", () =>
    Effect.gen(function* () {
      const data = yield* makeProgramSnapshotData();
      const firstRow = data.rows[0];
      if (!firstRow) {
        return yield* Effect.die(
          new UnexpectedGroupTestState({ operation: "select-program-row" })
        );
      }
      const release = testSignedRelease(
        ContentReleaseManifestSchema.make({
          ...testEmptyManifest(releaseId),
          scope: testPublicationScope({ snapshots: data.snapshots }),
          snapshots: data.snapshots,
        })
      );
      const request = yield* Schema.decodeEffect(StageGroupRequestSchema)({
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
      yield* Effect.promise(() =>
        t.mutation((ctx) =>
          insertSignedCandidate(
            ctx,
            releaseId,
            release,
            JSON.stringify(TEST_PROOF_RENDERER)
          )
        )
      );

      const firstRequest = request.requests[0];
      yield* Effect.promise(() =>
        t.action((ctx) =>
          runConvexProgram(
            stagePublication(ctx, firstRequest, TEST_KEY_ID).pipe(
              Effect.provideService(
                ContentVerificationKeyResolver,
                TEST_KEY_RESOLVER
              )
            )
          )
        )
      );

      /** Executes the same authenticated group against the durable test store. */
      const runGroup = Effect.fn("contentRelease.ingress.test.runGroup")(
        function* () {
          return yield* Effect.promise(() =>
            t.action((ctx) =>
              runConvexProgram(
                stagePublicationGroup(ctx, request, TEST_KEY_ID).pipe(
                  Effect.provideService(
                    ContentVerificationKeyResolver,
                    TEST_KEY_RESOLVER
                  )
                )
              )
            )
          );
        }
      );
      expect(yield* runGroup()).toEqual({
        ok: true,
        operation: "stageGroup",
        value: { releaseId, requestCount: 2 },
      });
      expect(yield* runGroup()).toMatchObject({ ok: true });

      const stored = yield* Effect.promise(() =>
        t.run((ctx) =>
          runConvexProgram(
            Effect.all({
              batches: Effect.promise(() =>
                ctx.db.query("snapshotBatches").collect()
              ),
              snapshots: Effect.promise(() =>
                ctx.db.query("contentSnapshots").collect()
              ),
            })
          )
        )
      );
      expect(stored).toMatchObject({
        batches: [expect.objectContaining({ batchIndex: 0 })],
        snapshots: [expect.objectContaining({ family: "program" })],
      });
    })
  );
});
