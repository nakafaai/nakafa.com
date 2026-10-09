import { describe, expect, it } from "@effect/vitest";
import { SignedContentArtifactSchema } from "@nakafa/aksara-contracts/content";
import { MaterialLessonProjectionSchema } from "@nakafa/aksara-contracts/projection/material";
import { SignedContentReleaseSchema } from "@nakafa/aksara-contracts/release";
import { RendererManifestEnvelopeSchema } from "@nakafa/aksara-contracts/renderer/contract";
import {
  MAX_PUBLIC_RUNTIME_REQUEST_BYTES,
  MAX_PUBLIC_RUNTIME_RESPONSE_BYTES,
  PublicContentRuntimeResponseSchema,
} from "@nakafa/aksara-contracts/runtime/spec";
import {
  MAX_PUBLIC_RUNTIME_BATCH_REQUEST_BYTES,
  MAX_PUBLIC_RUNTIME_BATCH_RESPONSE_BYTES,
  PUBLIC_CONTENT_RUNTIME_BATCH_SIZE,
  PublicContentRuntimeBatchRequestSchema,
  PublicContentRuntimeBatchResponseSchema,
  publicRuntimeResponseBytes,
} from "@repo/backend/content/batch";
import { testArtifactJson } from "@repo/backend/test/content/artifact";
import { testProjectionJson } from "@repo/backend/test/content/material";
import {
  TEST_DIGEST,
  TEST_MANIFEST_HASH,
  TEST_RELEASE_ID,
  testReleaseJson,
  testRendererJson,
} from "@repo/backend/test/content/release";
import { Array as Arr, Result, Schema } from "effect";

const decodeArtifact = Schema.decodeUnknownSync(
  Schema.fromJsonString(SignedContentArtifactSchema)
);
const decodeProjection = Schema.decodeUnknownSync(
  Schema.fromJsonString(MaterialLessonProjectionSchema)
);
const decodeRelease = Schema.decodeUnknownSync(
  Schema.fromJsonString(SignedContentReleaseSchema)
);
const decodeRenderer = Schema.decodeUnknownSync(
  Schema.fromJsonString(RendererManifestEnvelopeSchema)
);

/** Creates one structurally exact Aksara public found response. */
function foundResponse(title = "Technical title") {
  return Schema.decodeSync(PublicContentRuntimeResponseSchema)({
    activeManifestHash: TEST_MANIFEST_HASH,
    activeReleaseId: TEST_RELEASE_ID,
    artifact: decodeArtifact(testArtifactJson()),
    delivery: "public",
    kind: "found",
    projection: decodeProjection(testProjectionJson({ title })),
    projectionHash: TEST_DIGEST,
    release: decodeRelease(testReleaseJson()),
    rendererManifest: decodeRenderer(testRendererJson()),
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
      expect(Arr.map(result.success.responses, ({ kind }) => kind)).toEqual([
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
    expect(publicRuntimeResponseBytes(oversized)).toBeGreaterThan(
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
});
