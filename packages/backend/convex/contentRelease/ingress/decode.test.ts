import { describe, expect, it } from "@effect/vitest";
import {
  MAX_ARTIFACT_BATCH_BYTES,
  MAX_ITEM_BATCH_BYTES,
  MAX_PROJECTION_BATCH_BYTES,
  MAX_PUBLICATION_REQUEST_BYTES,
  MAX_ROUTE_BATCH_BYTES,
  MAX_SNAPSHOT_BATCH_BYTES,
  MAX_STAGE_GROUP_BYTES,
} from "@nakafa/aksara-contracts/transport/limits";
import { PublicationRequestSchema } from "@nakafa/aksara-contracts/transport/request";
import {
  decodePublicationBody,
  publicationRequestLimit,
  validateRequestBytes,
} from "@repo/backend/convex/contentRelease/ingress/decode";
import { testProjectionJson } from "@repo/backend/test/content/material";
import { testUpsertJson } from "@repo/backend/test/content/release";
import { Effect, Result, Schema } from "effect";

/** Decodes one exact source at the Vitest boundary. */
function decode(
  source: string,
  bytes = new TextEncoder().encode(source).byteLength
) {
  return decodePublicationBody(source, bytes).pipe(Effect.result);
}
describe("content publication request decoding", () => {
  it.live("strictly decodes one exact JSON request", () =>
    Effect.gen(function* () {
      expect(yield* decode('{"operation":"current"}')).toEqual(
        Result.succeed({ operation: "current" })
      );
    })
  );
  it.live.each([
    ["", 0],
    ["{", 1],
    ['{"operation":"current","extra":true}', 36],
    ['{"operation":"current"}', 1],
  ] as const)(
    "rejects malformed, excess, or contradictory bytes",
    ([source, bytes]) =>
      Effect.gen(function* () {
        const result = yield* decode(source, bytes);
        expect(result).toMatchObject({
          _tag: "Failure",
          failure: { code: "CONTENT_RELEASE_INVALID_REQUEST" },
        });
      })
  );
  it.live("rejects complete and operation-specific size violations", () =>
    Effect.gen(function* () {
      const tooLarge = "x".repeat(MAX_PUBLICATION_REQUEST_BYTES + 1);
      const complete = yield* decode(tooLarge);
      const batchRequest = yield* Schema.decodeEffect(
        Schema.fromJsonString(PublicationRequestSchema)
      )(
        `{"batchIndex":0,"items":[${testUpsertJson()}],"operation":"stageItemBatch","releaseId":"release-test"}`
      );
      const batch = yield* validateRequestBytes(
        batchRequest,
        MAX_ITEM_BATCH_BYTES + 1
      ).pipe(Effect.result);
      expect(complete).toMatchObject({
        _tag: "Failure",
        failure: { code: "CONTENT_RELEASE_SIZE" },
      });
      expect(batch).toMatchObject({
        _tag: "Failure",
        failure: { code: "CONTENT_RELEASE_SIZE" },
      });
    })
  );
  it.live("rejects an oversized grouped child before dispatch", () =>
    Effect.gen(function* () {
      const projectionRequest = yield* Schema.decodeEffect(
        PublicationRequestSchema
      )({
        batchIndex: 0,
        operation: "stageProjectionBatch",
        projections: [JSON.parse(testProjectionJson())],
        releaseId: "release-test",
      });
      expect(projectionRequest.operation).toBe("stageProjectionBatch");
      if (projectionRequest.operation !== "stageProjectionBatch") {
        return yield* Effect.die(
          new Error("Expected a projection batch request fixture.")
        );
      }
      const [projection] = projectionRequest.projections;
      const source = JSON.stringify({
        operation: "stageGroup",
        releaseId: projectionRequest.releaseId,
        requests: [
          {
            ...projectionRequest,
            projections: [
              {
                ...projection,
                metadata: {
                  ...projection.metadata,
                  title: "x".repeat(MAX_PROJECTION_BATCH_BYTES),
                },
              },
            ],
          },
        ],
      });
      expect(yield* decode(source)).toMatchObject({
        _tag: "Failure",
        failure: { code: "CONTENT_RELEASE_SIZE" },
      });
    })
  );
  it("derives every operation ceiling from shared transport constants", () => {
    expect(publicationRequestLimit("stageArtifactBatch")).toBe(
      MAX_ARTIFACT_BATCH_BYTES
    );
    expect(publicationRequestLimit("stageItemBatch")).toBe(
      MAX_ITEM_BATCH_BYTES
    );
    expect(publicationRequestLimit("stageGroup")).toBe(MAX_STAGE_GROUP_BYTES);
    expect(publicationRequestLimit("stageProjectionBatch")).toBe(
      MAX_PROJECTION_BATCH_BYTES
    );
    expect(publicationRequestLimit("stageRollbackProjectionBatch")).toBe(
      MAX_PROJECTION_BATCH_BYTES
    );
    expect(publicationRequestLimit("stageRouteBatch")).toBe(
      MAX_ROUTE_BATCH_BYTES
    );
    expect(publicationRequestLimit("stageSnapshotBatch")).toBe(
      MAX_SNAPSHOT_BATCH_BYTES
    );
    for (const operation of [
      "accept",
      "abort",
      "activate",
      "activateRecovery",
      "cleanup",
      "current",
      "headPage",
      "recovery",
      "rollbackPage",
      "routePage",
      "stageRecovery",
      "stageRelease",
      "stageSnapshot",
      "stageTryoutRuntimeBundle",
      "status",
      "verify",
    ] as const) {
      expect(publicationRequestLimit(operation)).toBe(
        MAX_PUBLICATION_REQUEST_BYTES
      );
    }
  });
});
