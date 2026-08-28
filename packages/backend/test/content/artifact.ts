import type { ArtifactLocaleSchema } from "@nakafa/aksara-contracts/locale";
import type { RendererDomain } from "@nakafa/aksara-contracts/renderer/domain";
import {
  TEST_ARTIFACT_HASH,
  TEST_DIGEST,
} from "@repo/backend/test/content/release";
import type { Schema } from "effect";

type ArtifactLocaleCode = Schema.Codec.Encoded<typeof ArtifactLocaleSchema>;
/** Creates one schema-valid technical signed artifact. */
export function testArtifactJson(options?: {
  readonly artifactHash?: string;
  readonly artifactLocale?: ArtifactLocaleCode;
  readonly compiledCode?: string;
  readonly contentKey?: string;
  readonly plainText?: string;
  readonly rendererDomain?: RendererDomain;
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
