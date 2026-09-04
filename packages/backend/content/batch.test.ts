import { describe, expect, it } from "@effect/vitest";
import {
  MAX_PUBLIC_RUNTIME_REQUEST_BYTES,
  MAX_PUBLIC_RUNTIME_RESPONSE_BYTES,
  PublicContentRuntimeFoundSchema,
} from "@nakafa/aksara-contracts/runtime/spec";
import {
  MAX_PUBLIC_RUNTIME_BATCH_REQUEST_BYTES,
  MAX_PUBLIC_RUNTIME_BATCH_RESPONSE_BYTES,
  PUBLIC_CONTENT_RUNTIME_BATCH_SIZE,
  PublicContentRuntimeBatchRequestSchema,
  PublicContentRuntimeBatchResponseSchema,
} from "@repo/backend/content/batch";
import {
  BoundedPublicRuntimeFoundSchema,
  publicRuntimeBytes,
} from "@repo/backend/content/runtime";
import { testArtifactJson } from "@repo/backend/test/content/artifact";
import { testProjectionJson } from "@repo/backend/test/content/material";
import {
  TEST_DIGEST,
  TEST_MANIFEST_HASH,
  TEST_RELEASE_ID,
  testReleaseJson,
  testRendererJson,
} from "@repo/backend/test/content/release";
import { Result, Schema } from "effect";

/** Creates one structurally exact Aksara public found response. */
function foundResponse(title = "Technical title") {
  return Schema.decodeSync(PublicContentRuntimeFoundSchema)({
    activeManifestHash: TEST_MANIFEST_HASH,
    activeReleaseId: TEST_RELEASE_ID,
    artifact: JSON.parse(testArtifactJson()),
    delivery: "public",
    kind: "found",
    projection: JSON.parse(testProjectionJson({ title })),
    projectionHash: TEST_DIGEST,
    release: JSON.parse(testReleaseJson()),
    rendererManifest: JSON.parse(testRendererJson()),
    sourcePath: "packages/corpus/test/head-0/en.mdx",
  });
}
describe("public content runtime batch contract", () => {
  it("derives exact eight-item wire ceilings from Aksara singular limits", () => {
    expect(PUBLIC_CONTENT_RUNTIME_BATCH_SIZE).toBe(8);
    expect(MAX_PUBLIC_RUNTIME_BATCH_REQUEST_BYTES).toBe(
      8 * MAX_PUBLIC_RUNTIME_REQUEST_BYTES + 64
    );
    expect(MAX_PUBLIC_RUNTIME_BATCH_RESPONSE_BYTES).toBe(
      8 * MAX_PUBLIC_RUNTIME_RESPONSE_BYTES + 64
    );
  });
  it("accepts one to eight exact public requests and rejects larger batches", () => {
    const request = {
      appLocale: "en",
      delivery: "public",
      publicPath: "subjects/mathematics/topic/lesson",
    };
    const decode = Schema.decodeUnknownResult(
      PublicContentRuntimeBatchRequestSchema
    );
    expect(Result.isSuccess(decode({ requests: [request] }))).toBe(true);
    expect(
      Result.isSuccess(
        decode({ requests: Array.from({ length: 8 }, () => request) })
      )
    ).toBe(true);
    expect(Result.isFailure(decode({ requests: [] }))).toBe(true);
    expect(
      Result.isFailure(
        decode({ requests: Array.from({ length: 9 }, () => request) })
      )
    ).toBe(true);
  });
  it("preserves ordered found and missing responses without item failures", () => {
    const decode = Schema.decodeUnknownResult(
      PublicContentRuntimeBatchResponseSchema
    );
    const found = foundResponse();
    const result = decode({ responses: [found, { kind: "missing" }] });
    expect(Result.isSuccess(result)).toBe(true);
    if (Result.isSuccess(result)) {
      expect(result.success.responses.map(({ kind }) => kind)).toEqual([
        "found",
        "missing",
      ]);
    }
    expect(
      Result.isFailure(
        decode({
          responses: [{ code: "CONTENT_RUNTIME_INTERNAL", kind: "failure" }],
        })
      )
    ).toBe(true);
    expect(
      Result.isFailure(
        decode({
          responses: Array.from({ length: 9 }, () => ({ kind: "missing" })),
        })
      )
    ).toBe(true);
  });
  it("rejects one exact response above the Aksara singular byte ceiling", () => {
    const oversized = foundResponse(
      "x".repeat(MAX_PUBLIC_RUNTIME_RESPONSE_BYTES)
    );
    expect(publicRuntimeBytes(oversized)).toBeGreaterThan(
      MAX_PUBLIC_RUNTIME_RESPONSE_BYTES
    );
    expect(
      Result.isFailure(
        Schema.decodeResult(PublicContentRuntimeBatchResponseSchema)({
          responses: [oversized],
        })
      )
    ).toBe(true);
  });
  it("accepts the exact Aksara singular response byte boundary", () => {
    const empty = foundResponse("");
    const boundary = foundResponse(
      "x".repeat(MAX_PUBLIC_RUNTIME_RESPONSE_BYTES - publicRuntimeBytes(empty))
    );

    expect(publicRuntimeBytes(boundary)).toBe(
      MAX_PUBLIC_RUNTIME_RESPONSE_BYTES
    );
    expect(
      Result.isSuccess(
        Schema.decodeResult(BoundedPublicRuntimeFoundSchema)(boundary)
      )
    ).toBe(true);
  });
});
