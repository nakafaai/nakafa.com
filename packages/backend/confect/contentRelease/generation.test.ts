import { describe, expect, it } from "@effect/vitest";
import {
  requireCurrentArtifact,
  requireCurrentRelease,
} from "@repo/backend/confect/contentRelease/generation";
import { Effect } from "effect";

const ARTIFACT_HASH = `sha256:${"a".repeat(64)}`;
const IDENTITY = "release-test/0/prior";
const RELEASE_ID = "release-retired";

/** One artifact signed under the retired Aksara 0.51 contract, with the exact fields that contract stored. */
const RETIRED_ARTIFACT = `{
  "artifactHash": "${ARTIFACT_HASH}",
  "keyId": "retired-key",
  "payload": {
    "artifactLocale": "en",
    "byteLength": 33,
    "compiledCode": "function Body() { return null; }",
    "compilerConfigHash": "${ARTIFACT_HASH}",
    "compilerVersion": "0.1.0",
    "contentKey": "program:retired",
    "format": "mdx-function-body",
    "mdxCompilerVersion": "3.1.1",
    "plainText": "Retired body",
    "rawMdx": "Retired body",
    "rendererDomain": "biology",
    "requiredComponents": ["InlineMath"],
    "sourceHash": "${ARTIFACT_HASH}"
  },
  "signature": "${"A".repeat(86)}"
}`;

describe("contentRelease/generation", () => {
  it.live("accepts stored artifacts the current contract can read", () =>
    Effect.gen(function* () {
      for (const source of [
        "{",
        "[]",
        "{}",
        '{"payload":3}',
        '{"payload":{}}',
        '{"payload":{"format":"content-tree"}}',
        '{"payload":{"format":"other-format"}}',
        '{"payload":{"requiredComponents":"InlineMath"}}',
        '{"payload":{"requiredComponents":[]}}',
        '{"payload":{"requiredComponents":["InlineMath"]}}',
        '{"payload":{"requiredComponents":[null]}}',
        '{"payload":{"requiredComponents":[{"name":"InlineMath"}]}}',
      ]) {
        yield* requireCurrentArtifact(source, IDENTITY, ARTIFACT_HASH);
      }
    })
  );

  it.live(
    "rejects an artifact signed in the retired compiled-body format",
    () =>
      Effect.gen(function* () {
        const retired = yield* requireCurrentArtifact(
          RETIRED_ARTIFACT,
          IDENTITY,
          ARTIFACT_HASH
        ).pipe(Effect.flip);

        expect(retired).toMatchObject({
          code: "CONTENT_RELEASE_UNSUPPORTED",
          message: `Rollback state ${IDENTITY} cannot read artifact ${ARTIFACT_HASH}, which was signed under a retired content contract. Publish a new release instead of rolling back across the contract change.`,
        });
      })
  );

  it.live("rejects an artifact whose components carry versions", () =>
    Effect.gen(function* () {
      const retired = yield* requireCurrentArtifact(
        '{"payload":{"requiredComponents":[{"name":"InlineMath","version":1}]}}',
        IDENTITY,
        ARTIFACT_HASH
      ).pipe(Effect.flip);

      expect(retired).toMatchObject({
        code: "CONTENT_RELEASE_UNSUPPORTED",
        message: `Rollback state ${IDENTITY} cannot read artifact ${ARTIFACT_HASH}, which was signed under a retired content contract. Publish a new release instead of rolling back across the contract change.`,
      });
    })
  );

  it.live("accepts stored releases the current contract can read", () =>
    Effect.gen(function* () {
      for (const source of [
        "{",
        "3",
        "{}",
        '{"manifest":"current"}',
        '{"manifest":{}}',
        '{"manifest":{"rendererContractVersion":1}}',
      ]) {
        yield* requireCurrentRelease(source, RELEASE_ID);
      }
    })
  );

  it.live("rejects a release that declares a renderer contract version", () =>
    Effect.gen(function* () {
      const retired = yield* requireCurrentRelease(
        '{"manifest":{"rendererContractVersion":"1.0.0"}}',
        RELEASE_ID
      ).pipe(Effect.flip);

      expect(retired).toMatchObject({
        code: "CONTENT_RELEASE_UNSUPPORTED",
        message: `Content release ${RELEASE_ID} was signed under a retired content contract, so this deployment cannot read it. Republish the content to inspect that release again.`,
      });
    })
  );
});
