import type { RendererDomain } from "@nakafa/aksara-contracts/renderer/domain";
import {
  TEST_ARTIFACT_HASH,
  TEST_DIGEST,
} from "@repo/backend/test/content-release";

/** Creates one schema-valid technical signed artifact. */
export function testArtifactJson(options?: {
  readonly artifactHash?: string;
  readonly compiledCode?: string;
  readonly contentKey?: string;
  readonly locale?: "en" | "id";
  readonly plainText?: string;
  readonly rendererDomain?: RendererDomain;
}) {
  const compiledCode = options?.compiledCode ?? "return {};";
  return JSON.stringify({
    artifactHash: options?.artifactHash ?? TEST_ARTIFACT_HASH,
    keyId: "test-key",
    payload: {
      byteLength: new TextEncoder().encode(compiledCode).byteLength,
      compiledCode,
      compilerConfigHash: TEST_DIGEST,
      compilerVersion: "0.1.0",
      contentKey: options?.contentKey ?? "test:head-0",
      format: "mdx-function-body-v1",
      locale: options?.locale ?? "en",
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
