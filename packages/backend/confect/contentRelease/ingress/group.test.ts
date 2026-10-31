import { RegisteredConvexFunction, RegisteredFunction } from "@confect/server";
import confectSchema from "@repo/backend/confect/_generated/schema";
// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { ReleaseIdSchema } from "@nakafa/aksara-contracts/ids";
import { ContentProjectionSchema } from "@nakafa/aksara-contracts/projection/spec";
import {
  ContentReleaseItemSchema,
  ContentReleaseManifestSchema,
} from "@nakafa/aksara-contracts/release";
import { RendererManifestEnvelopeSchema } from "@nakafa/aksara-contracts/renderer/contract";
import { ContentVerificationKeyResolver } from "@nakafa/aksara-contracts/signature/spec";
import { StageGroupRequestSchema } from "@nakafa/aksara-contracts/transport/group";
import { stagePublicationGroup } from "@repo/backend/confect/contentRelease/ingress/group";
import { stagePublication } from "@repo/backend/confect/contentRelease/ingress/stage";
import { convexModules } from "@repo/backend/confect/test.setup";
import schema from "@repo/backend/convex/schema";
import { testProjectionJson } from "@repo/backend/test/content/material";
import {
  TEST_KEY_ID,
  TEST_KEY_RESOLVER,
  TEST_PROOF_RENDERER,
  testEmptyManifest,
  testSignedRelease,
} from "@repo/backend/test/content/proof";
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
const UpsertJsonSchema = Schema.fromJsonString(ContentReleaseItemSchema);
const ProjectionJsonSchema = Schema.fromJsonString(ContentProjectionSchema);
const RendererJsonSchema = Schema.fromJsonString(
  RendererManifestEnvelopeSchema
);
class UnexpectedGroupTestState extends Data.TaggedError(
  "UnexpectedGroupTestState"
)<{
  readonly operation: "select-program-row";
}> {}
describe("content release staging groups", () => {
  it.effect("stages authenticated projections through a recovery group", () =>
    Effect.gen(function* () {
      const runtimeServices = yield* Effect.context<never>();
      const item = yield* Schema.decodeEffect(UpsertJsonSchema)(
        testUpsertJson({ releaseId })
      );
      const projection = yield* Schema.decodeEffect(ProjectionJsonSchema)(
        testProjectionJson()
      );
      const request = yield* Schema.decodeEffect(StageGroupRequestSchema)({
        operation: "stageGroup",
        releaseId,
        requests: [
          {
            batchIndex: 0,
            items: [item],
            operation: "stageItemBatch",
            releaseId,
          },
          {
            batchIndex: 0,
            operation: "stageProjectionBatch",
            projections: [projection],
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
        projectionJson: testProjectionJson(),
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
      const emptyManifest = yield* testEmptyManifest(releaseId);
      const release = yield* testSignedRelease(
        ContentReleaseManifestSchema.make({
          ...emptyManifest,
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
            Schema.encodeSync(RendererJsonSchema)(TEST_PROOF_RENDERER)
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
