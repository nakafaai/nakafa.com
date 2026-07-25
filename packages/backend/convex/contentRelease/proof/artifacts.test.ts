// @vitest-environment node

import { ContentVerificationKeyResolver } from "@nakafa/aksara-contracts/signature/spec";
import { verifyArtifacts } from "@repo/backend/convex/contentRelease/proof/artifacts";
import {
  TEST_KEY_RESOLVER,
  TEST_PROOF_RENDERER,
  testSignedArtifact,
} from "@repo/backend/test/content-proof";
import {
  TEST_DIGEST,
  TEST_RELEASE_ID,
  testDeleteJson,
  testRollbackJson,
} from "@repo/backend/test/content-release";
import { Effect, Stream } from "effect";
import { describe, expect, it } from "vitest";

/** Builds one canonical upsert item bound to a selected artifact. */
function upsertJson(
  artifact: ReturnType<typeof testSignedArtifact>,
  values?: {
    readonly artifactHash?: string;
    readonly contentKey?: string;
    readonly locale?: "en" | "id";
    readonly rendererDomain?: "chemistry" | "mathematics";
  }
) {
  return JSON.stringify({
    change: {
      artifactHash: values?.artifactHash ?? artifact.artifactHash,
      contentKey: values?.contentKey ?? "test:head-0",
      delivery: "public",
      family: "material",
      locale: values?.locale ?? "en",
      operation: "upsert",
      rendererDomain: values?.rendererDomain ?? "mathematics",
      sourcePath: "packages/corpus/test/head-0/en.mdx",
    },
    index: 0,
    releaseId: TEST_RELEASE_ID,
  });
}

/** Runs artifact stream verification with the selected key resolver. */
function verification(
  rows: ReadonlyArray<{
    artifactJson?: string;
    index: number;
    itemJson: string;
  }>,
  resolver = TEST_KEY_RESOLVER
) {
  return verifyArtifacts(
    Stream.fromIterable(
      rows.map((row) => ({ ...row, rollbackJson: testRollbackJson() }))
    ),
    TEST_RELEASE_ID,
    TEST_PROOF_RENDERER,
    TEST_PROOF_RENDERER.rendererContractVersion
  ).pipe(Effect.provideService(ContentVerificationKeyResolver, resolver));
}

/** Runs successful artifact verification at the test boundary. */
function verify(
  rows: Parameters<typeof verification>[0],
  resolver = TEST_KEY_RESOLVER
) {
  return Effect.runPromise(verification(rows, resolver));
}

/** Returns the expected typed artifact verification failure. */
function reject(
  rows: Parameters<typeof verification>[0],
  resolver = TEST_KEY_RESOLVER
) {
  return Effect.runPromise(verification(rows, resolver).pipe(Effect.flip));
}

describe("contentRelease/proof/artifacts", () => {
  it("authenticates one valid upsert and ignores a body-free delete", async () => {
    const artifact = testSignedArtifact();
    await expect(
      verify([
        {
          artifactJson: JSON.stringify(artifact),
          index: 0,
          itemJson: upsertJson(artifact),
        },
        { index: 1, itemJson: testDeleteJson({ index: 1 }) },
      ])
    ).resolves.toBe(1);
  });

  it("rejects unexpected and missing artifact bodies", async () => {
    const artifact = testSignedArtifact();
    await expect(
      reject([
        {
          artifactJson: JSON.stringify(artifact),
          index: 0,
          itemJson: testDeleteJson(),
        },
      ])
    ).resolves.toMatchObject({ code: "CONTENT_RELEASE_INTEGRITY" });
    await expect(
      reject([{ index: 0, itemJson: upsertJson(artifact) }])
    ).resolves.toMatchObject({ code: "CONTENT_RELEASE_MISSING" });
  });

  it("rejects every artifact-to-item identity mismatch", async () => {
    const artifact = testSignedArtifact();
    const chemistry = testSignedArtifact("chemistry");
    const mismatches = [
      upsertJson(artifact, { artifactHash: TEST_DIGEST }),
      upsertJson(artifact, { contentKey: "test:other" }),
      upsertJson(artifact, { locale: "id" }),
      upsertJson(chemistry),
    ];
    for (const itemJson of mismatches) {
      const selected = itemJson === mismatches.at(-1) ? chemistry : artifact;
      await expect(
        reject([
          {
            artifactJson: JSON.stringify(selected),
            index: 0,
            itemJson,
          },
        ])
      ).resolves.toMatchObject({ code: "CONTENT_RELEASE_INTEGRITY" });
    }
  });

  it("maps signature trust failures into the stable unsupported channel", async () => {
    const artifact = testSignedArtifact();
    await expect(
      reject([
        {
          artifactJson: JSON.stringify({
            ...artifact,
            keyId: "unreviewed-key",
          }),
          index: 0,
          itemJson: upsertJson(artifact),
        },
      ])
    ).resolves.toMatchObject({ code: "CONTENT_RELEASE_UNSUPPORTED" });
  });
});
