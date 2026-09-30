import type { ArtifactLocaleSchema } from "@nakafa/aksara-contracts/locale";
import type { RendererDomain } from "@nakafa/aksara-contracts/renderer/domain";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  TEST_ARTIFACT_HASH,
  TEST_DIGEST,
  testTextHash,
} from "@repo/backend/test/content/release";
import type { Schema } from "effect";

type ArtifactLocaleCode = Schema.Codec.Encoded<typeof ArtifactLocaleSchema>;

/** Stores one artifact body with the facts that staging writes beside it. */
export async function insertTestArtifact(
  ctx: MutationCtx,
  artifact: {
    readonly artifactHash: string;
    readonly artifactJson: string;
    readonly retainUntil?: number | undefined;
  }
) {
  const artifactId = await ctx.db.insert("contentArtifacts", {
    artifactHash: artifact.artifactHash,
    artifactJson: artifact.artifactJson,
  });
  await ctx.db.insert("contentArtifactFacts", {
    artifactHash: artifact.artifactHash,
    artifactId,
    artifactJsonHash: testTextHash(artifact.artifactJson),
    retainUntil: artifact.retainUntil ?? Number.MAX_SAFE_INTEGER,
  });
  return artifactId;
}
/** Creates one schema-valid technical signed artifact. */
export function testArtifactJson(options?: {
  readonly artifactHash?: string | undefined;
  readonly artifactLocale?: ArtifactLocaleCode | undefined;
  readonly compiledCode?: string | undefined;
  readonly contentKey?: string | undefined;
  readonly plainText?: string | undefined;
  readonly rendererDomain?: RendererDomain | undefined;
}) {
  const compiledCode = options?.compiledCode ?? "return {};";
  return JSON.stringify({
    artifactHash: options?.artifactHash ?? TEST_ARTIFACT_HASH,
    keyId: "test-key",
    payload: {
      artifactLocale: options?.artifactLocale ?? "en",
      byteLength: new TextEncoder().encode(compiledCode).byteLength,
      compiledCode,
      compilerConfigHash: TEST_DIGEST,
      compilerVersion: "0.1.0",
      contentKey: options?.contentKey ?? "test:head-0",
      format: "mdx-function-body",
      mdxCompilerVersion: "3.1.1",
      plainText: options?.plainText ?? "Technical fixture",
      rawMdx: "## Technical fixture",
      rendererDomain: options?.rendererDomain ?? "mathematics",
      requiredComponents: [],
      sourceHash: TEST_DIGEST,
    },
    signature: "A".repeat(86),
  });
}
