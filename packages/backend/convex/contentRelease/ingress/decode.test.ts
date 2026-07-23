import {
  MAX_ARTIFACT_BATCH_BYTES,
  MAX_ITEM_BATCH_BYTES,
  MAX_PROJECTION_BATCH_BYTES,
  MAX_PUBLICATION_REQUEST_BYTES,
  MAX_ROUTE_BATCH_BYTES,
} from "@nakafa/aksara-contracts/transport/limits";
import { PublicationRequestSchema } from "@nakafa/aksara-contracts/transport/request";
import {
  decodePublicationBody,
  publicationRequestLimit,
  validateRequestBytes,
} from "@repo/backend/convex/contentRelease/ingress/decode";
import { testUpsertJson } from "@repo/backend/test/content-release";
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
  ])("rejects malformed, excess, or contradictory bytes", async (source, bytes) => {
    const result = await decode(source, bytes);

    expect(result).toMatchObject({
      _tag: "Left",
      left: { code: "CONTENT_RELEASE_INVALID_REQUEST" },
    });
  });

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

  it("derives every operation ceiling from shared transport constants", () => {
    expect(publicationRequestLimit("stageArtifactBatch")).toBe(
      MAX_ARTIFACT_BATCH_BYTES
    );
    expect(publicationRequestLimit("stageItemBatch")).toBe(
      MAX_ITEM_BATCH_BYTES
    );
    expect(publicationRequestLimit("stageProjectionBatch")).toBe(
      MAX_PROJECTION_BATCH_BYTES
    );
    expect(publicationRequestLimit("stageRouteBatch")).toBe(
      MAX_ROUTE_BATCH_BYTES
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
      "status",
      "verify",
    ] as const) {
      expect(publicationRequestLimit(operation)).toBe(
        MAX_PUBLICATION_REQUEST_BYTES
      );
    }
  });
});
