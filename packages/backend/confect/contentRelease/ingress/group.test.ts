import { RegisteredConvexFunction, RegisteredFunction } from "@confect/server";
import confectSchema from "@repo/backend/confect/_generated/schema";
// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { ReleaseIdSchema } from "@nakafa/aksara-contracts/ids";
import { ContentReleaseManifestSchema } from "@nakafa/aksara-contracts/release";
import { ContentVerificationKeyResolver } from "@nakafa/aksara-contracts/signature/spec";
import { StageGroupRequestSchema } from "@nakafa/aksara-contracts/transport/group";
import { stagePublicationGroup } from "@repo/backend/confect/contentRelease/ingress/group";
import { stagePublication } from "@repo/backend/confect/contentRelease/ingress/stage";
import { convexModules } from "@repo/backend/confect/test.setup";
import schema from "@repo/backend/convex/schema";
import {
  TEST_KEY_ID,
  TEST_KEY_RESOLVER,
  TEST_PROOF_RENDERER,
  testEmptyManifest,
  testSignedRelease,
} from "@repo/backend/test/content/proof";
import {
  TEST_QUESTION_CONTENT_KEY,
  TEST_QUESTION_PROJECTION,
  TEST_QUESTION_PROJECTION_JSON,
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
  it.effect(
    "stages authenticated Question projections through a recovery group",
    () =>
      Effect.gen(function* () {
        const runtimeServices = yield* Effect.context<never>();
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
              operation: "stageProjectionBatch",
              projections: [TEST_QUESTION_PROJECTION],
              releaseId,
            },
          ],
        });
        const t = convexTest(schema, convexModules);
        yield* Effect.promise(() =>
          t.mutation((ctx) =>
            insertTestRelease(ctx, {
              releaseId,
              role: "recovery",
            })
          )
        );
        expect(
          yield* Effect.promise(() =>
            t.action((ctx) =>
              Effect.runPromiseWith(runtimeServices)(
                stagePublicationGroup(request).pipe(
                  Effect.provideService(
                    ContentVerificationKeyResolver,
                    TEST_KEY_RESOLVER
                  ),
                  Effect.provide(
                    RegisteredFunction.actionLayer(confectSchema, ctx)
                  )
                )
              )
            )
          )
        ).toEqual({
          ok: true,
          operation: "stageGroup",
          value: {
            releaseId,
            requestCount: 2,
          },
        });
        expect(
          yield* Effect.promise(() =>
            t.run((ctx) => ctx.db.query("contentItems").unique())
          )
        ).toMatchObject({
          projectionJson: TEST_QUESTION_PROJECTION_JSON,
          projectionReady: true,
        });
      })
  );
  it.effect("resumes a committed prefix and retries the complete group", () =>
    Effect.gen(function* () {
      const runtimeServices = yield* Effect.context<never>();
      const data = yield* makeProgramSnapshotData();
      const firstRow = data.rows[0];
      if (!firstRow) {
        return yield* Effect.die(
          new UnexpectedGroupTestState({
            operation: "select-program-row",
          })
        );
      }
      const release = testSignedRelease(
        ContentReleaseManifestSchema.make({
          ...testEmptyManifest(releaseId),
          scope: testPublicationScope({
            snapshots: data.snapshots,
          }),
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
          Effect.runPromiseWith(runtimeServices)(
            stagePublication(firstRequest, TEST_KEY_ID).pipe(
              Effect.provideService(
                ContentVerificationKeyResolver,
                TEST_KEY_RESOLVER
              ),
              Effect.provide(RegisteredFunction.actionLayer(confectSchema, ctx))
            )
          )
        )
      );

      /** Executes the same authenticated group against the durable test store. */
      const runGroup = Effect.fn("contentRelease.ingress.test.runGroup")(
        function* () {
          const runtimeServices = yield* Effect.context<never>();
          return yield* Effect.promise(() =>
            t.action((ctx) =>
              Effect.runPromiseWith(runtimeServices)(
                stagePublicationGroup(request, TEST_KEY_ID).pipe(
                  Effect.provideService(
                    ContentVerificationKeyResolver,
                    TEST_KEY_RESOLVER
                  ),
                  Effect.provide(
                    RegisteredFunction.actionLayer(confectSchema, ctx)
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
        value: {
          releaseId,
          requestCount: 2,
        },
      });
      expect(yield* runGroup()).toMatchObject({
        ok: true,
      });
      const stored = yield* Effect.promise(() =>
        t.run((ctx) =>
          Effect.runPromiseWith(runtimeServices)(
            Effect.all({
              batches: Effect.promise(() =>
                ctx.db.query("snapshotBatches").collect()
              ),
              snapshots: Effect.promise(() =>
                ctx.db.query("contentSnapshots").collect()
              ),
            }).pipe(
              Effect.provide(
                RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
              )
            )
          )
        )
      );
      expect(stored).toMatchObject({
        batches: [
          expect.objectContaining({
            batchIndex: 0,
          }),
        ],
        snapshots: [
          expect.objectContaining({
            family: "program",
          }),
        ],
      });
    })
  );
});
