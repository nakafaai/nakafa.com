import { EMPTY_RESULT_CATALOG_DIGEST } from "@nakafa/aksara-contracts/release/result";
import { inheritContentSnapshots } from "@nakafa/aksara-contracts/release/snapshot";
import {
  decodeArtifactJson,
  decodeItemJson,
  decodeProjectionJson,
  decodeProofJson,
  decodeReleaseJson,
  decodeRendererJson,
  parseStoredJson,
} from "@repo/backend/convex/contentRelease/parse";
import {
  encodeArtifactJson,
  encodeItemJson,
  encodeProjectionJson,
  encodeReleaseJson,
  encodeRendererJson,
} from "@repo/backend/convex/contentRelease/wire";
import { testArtifactJson } from "@repo/backend/test/content-artifact";
import {
  TEST_DIGEST,
  TEST_MANIFEST_HASH,
  TEST_RELEASE_ID,
  testProjectionJson,
  testReleaseJson,
  testRendererJson,
  testUpsertJson,
} from "@repo/backend/test/content-release";
import { Effect, Exit } from "effect";
import { describe, expect, it } from "vitest";

/** Creates exact server-derived evidence for strict proof decoding. */
function testProofJson() {
  return JSON.stringify({
    baseManifestHash: null,
    baseReleaseId: null,
    baseResultCount: 0,
    baseResultDigest: EMPTY_RESULT_CATALOG_DIGEST,
    deleteHeads: 0,
    itemCount: 1,
    itemsDigest: TEST_DIGEST,
    manifestHash: TEST_MANIFEST_HASH,
    projectionCount: 1,
    projectionDigest: TEST_DIGEST,
    releaseId: TEST_RELEASE_ID,
    rendererContractVersion: "1.0.0",
    rendererManifestHash: TEST_DIGEST,
    resultCount: 1,
    resultDigest: TEST_DIGEST,
    rollbackCount: 1,
    rollbackDigest: TEST_DIGEST,
    routeCount: 1,
    routeDigest: TEST_DIGEST,
    snapshots: inheritContentSnapshots(null),
    stagedArtifacts: 1,
    stagedRoutes: 1,
    stagedSnapshotRows: 0,
    upsertHeads: 1,
  });
}

describe("contentRelease/parse", () => {
  it("round-trips every stored contract through its owning canonicalizer", async () => {
    const release = await Effect.runPromise(
      decodeReleaseJson(testReleaseJson())
    );
    const item = await Effect.runPromise(decodeItemJson(testUpsertJson()));
    const artifact = await Effect.runPromise(
      decodeArtifactJson(testArtifactJson())
    );
    const projection = await Effect.runPromise(
      decodeProjectionJson(testProjectionJson())
    );
    const renderer = await Effect.runPromise(
      decodeRendererJson(testRendererJson())
    );
    const proof = await Effect.runPromise(decodeProofJson(testProofJson()));

    expect(encodeReleaseJson(release)).toBe(JSON.stringify(release));
    expect(JSON.parse(encodeItemJson(item))).toEqual(item);
    expect(JSON.parse(encodeArtifactJson(artifact))).toEqual(artifact);
    expect(JSON.parse(encodeProjectionJson(projection))).toEqual(projection);
    expect(encodeRendererJson(renderer)).toBe(testRendererJson());
    expect(proof.releaseId).toBe(TEST_RELEASE_ID);
  });

  it("maps malformed and schema-invalid values to stable typed failures", async () => {
    const malformed = await Effect.runPromiseExit(decodeReleaseJson("{"));
    const failures = await Promise.all([
      Effect.runPromise(decodeReleaseJson("{}").pipe(Effect.flip)),
      Effect.runPromise(decodeItemJson("{}").pipe(Effect.flip)),
      Effect.runPromise(decodeArtifactJson("{}").pipe(Effect.flip)),
      Effect.runPromise(decodeProjectionJson("{}").pipe(Effect.flip)),
      Effect.runPromise(decodeProofJson("{}").pipe(Effect.flip)),
      Effect.runPromise(decodeRendererJson("{}").pipe(Effect.flip)),
    ]);

    expect(Exit.isFailure(malformed)).toBe(true);
    expect(failures).toHaveLength(6);
    expect(
      failures.every(({ code }) => code === "CONTENT_RELEASE_INTEGRITY")
    ).toBe(true);
  });

  it("parses unknown stored JSON once and maps invalid bytes", async () => {
    await expect(
      Effect.runPromise(parseStoredJson('{"ok":true}'))
    ).resolves.toEqual({ ok: true });
    await expect(
      Effect.runPromise(parseStoredJson("{").pipe(Effect.flip))
    ).resolves.toMatchObject({ code: "CONTENT_RELEASE_INTEGRITY" });
  });
});
