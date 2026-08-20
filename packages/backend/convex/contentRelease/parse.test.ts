import { ACTIVE_APP_LOCALE_CODES } from "@nakafa/aksara-contracts/locale";
import { EMPTY_RESULT_CATALOG_DIGEST } from "@nakafa/aksara-contracts/release/result/spec";
import { inheritContentSnapshots } from "@nakafa/aksara-contracts/release/snapshot/spec";
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
  FUNCTION_MATERIAL,
  testProjectionJson,
} from "@repo/backend/test/content-material";
import {
  TEST_DIGEST,
  TEST_MANIFEST_HASH,
  TEST_RELEASE_ID,
  testReleaseJson,
  testRendererJson,
  testUpsertJson,
} from "@repo/backend/test/content-release";
import { describe, expect, it } from "@repo/testing/effect";
import { Effect, Exit } from "effect";

/** Creates exact server-derived evidence for strict proof decoding. */
function testProofJson() {
  return JSON.stringify({
    activeAppLocales: ACTIVE_APP_LOCALE_CODES,
    baseActiveAppLocales: null,
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
  it.live(
    "round-trips every stored contract through its owning canonicalizer",
    () =>
      Effect.gen(function* () {
        const release = yield* decodeReleaseJson(testReleaseJson());
        const item = yield* decodeItemJson(testUpsertJson());
        const artifact = yield* decodeArtifactJson(testArtifactJson());
        const projection = yield* decodeProjectionJson(testProjectionJson());
        const renderer = yield* decodeRendererJson(testRendererJson());
        const proof = yield* decodeProofJson(testProofJson());

        expect(encodeReleaseJson(release)).toBe(JSON.stringify(release));
        expect(JSON.parse(encodeItemJson(item))).toEqual(item);
        expect(JSON.parse(encodeArtifactJson(artifact))).toEqual(artifact);
        expect(JSON.parse(encodeProjectionJson(projection))).toEqual(
          projection
        );
        expect(encodeRendererJson(renderer)).toBe(testRendererJson());
        expect(proof.releaseId).toBe(TEST_RELEASE_ID);
      })
  );

  it.live(
    "maps malformed and schema-invalid values to stable typed failures",
    () =>
      Effect.gen(function* () {
        const malformed = yield* Effect.exit(decodeReleaseJson("{"));
        const failures = yield* Effect.all(
          [
            decodeReleaseJson("{}").pipe(Effect.flip),
            decodeItemJson("{}").pipe(Effect.flip),
            decodeArtifactJson("{}").pipe(Effect.flip),
            decodeProjectionJson("{}").pipe(Effect.flip),
            decodeProofJson("{}").pipe(Effect.flip),
            decodeRendererJson("{}").pipe(Effect.flip),
          ],
          { concurrency: "unbounded" }
        );

        expect(Exit.isFailure(malformed)).toBe(true);
        expect(failures).toHaveLength(6);
        expect(
          failures.every(({ code }) => code === "CONTENT_RELEASE_INTEGRITY")
        ).toBe(true);
      })
  );

  it.live("rejects stored material without its canonical topic title", () =>
    Effect.gen(function* () {
      const { topicTitle: _topicTitle, ...incomplete } = FUNCTION_MATERIAL;

      expect(
        yield* decodeProjectionJson(JSON.stringify(incomplete)).pipe(
          Effect.flip
        )
      ).toMatchObject({ code: "CONTENT_RELEASE_INTEGRITY" });
    })
  );

  it.live("parses unknown stored JSON once and maps invalid bytes", () =>
    Effect.gen(function* () {
      expect(yield* parseStoredJson('{"ok":true}')).toEqual({ ok: true });
      expect(yield* parseStoredJson("{").pipe(Effect.flip)).toMatchObject({
        code: "CONTENT_RELEASE_INTEGRITY",
      });
    })
  );
});
