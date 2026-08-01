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
import { testUpsertJson } from "@repo/backend/test/content-release";
import { testProjectionJson } from "@repo/backend/test/content-material";
import { Effect, Either, Schema } from "effect";
import { describe, expect, it } from "vitest";

/** Decodes one exact source at the Vitest boundary. */
function decode(
  source: string,
  bytes = new TextEncoder().encode(source).byteLength
) {
  return Effect.runPromise(
    decodePublicationBody(source, bytes).pipe(Effect.either)
  );
}

describe("content publication request decoding", () => {
  it("strictly decodes one exact JSON request", async () => {
    await expect(decode('{"operation":"current"}')).resolves.toEqual(
      Either.right({ operation: "current" })
    );
  });

  it.each([
    ["", 0],
    ["{", 1],
    ['{"operation":"current","extra":true}', 36],
    ['{"operation":"current"}', 1],
  ])(
    "rejects malformed, excess, or contradictory bytes",
    async (source, bytes) => {
      const result = await decode(source, bytes);

      expect(result).toMatchObject({
        _tag: "Left",
        left: { code: "CONTENT_RELEASE_INVALID_REQUEST" },
      });
    }
  );

  it("rejects complete and operation-specific size violations", async () => {
    const tooLarge = "x".repeat(MAX_PUBLICATION_REQUEST_BYTES + 1);
    const complete = await decode(tooLarge);
    const batchRequest = Schema.decodeUnknownSync(
      Schema.parseJson(PublicationRequestSchema)
    )(
      `{"batchIndex":0,"items":[${testUpsertJson()}],"operation":"stageItemBatch","releaseId":"release-test"}`
    );
    const batch = await Effect.runPromise(
      validateRequestBytes(batchRequest, MAX_ITEM_BATCH_BYTES + 1).pipe(
        Effect.either
      )
    );

    expect(complete).toMatchObject({
      _tag: "Left",
      left: { code: "CONTENT_RELEASE_SIZE" },
    });
    expect(batch).toMatchObject({
      _tag: "Left",
      left: { code: "CONTENT_RELEASE_SIZE" },
    });
  });

  it("rejects an oversized grouped child before dispatch", async () => {
    const projectionRequest = Schema.decodeUnknownSync(
      PublicationRequestSchema
    )({
      batchIndex: 0,
      operation: "stageProjectionBatch",
      projections: [JSON.parse(testProjectionJson())],
      releaseId: "release-test",
    });
    expect(projectionRequest.operation).toBe("stageProjectionBatch");
    if (projectionRequest.operation !== "stageProjectionBatch") {
      return;
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

    await expect(decode(source)).resolves.toMatchObject({
      _tag: "Left",
      left: { code: "CONTENT_RELEASE_SIZE" },
    });
  });

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
      "status",
      "verify",
    ] as const) {
      expect(publicationRequestLimit(operation)).toBe(
        MAX_PUBLICATION_REQUEST_BYTES
      );
    }
  });
});
