import {
  AKSARA_COMPILER_VERSION,
  MDX_COMPILER_VERSION,
} from "@nakafa/aksara-contracts/content";
import type { ArtifactLocaleSchema } from "@nakafa/aksara-contracts/locale";
import type { RendererDomain } from "@nakafa/aksara-contracts/renderer/domain";
import type { ContentTreeElement } from "@nakafa/aksara-contracts/tree";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  TEST_ARTIFACT_HASH,
  TEST_DIGEST,
  testTextHash,
} from "@repo/backend/test/content/release";
import { encodeJsonText } from "@repo/utilities/json";
import type { Schema } from "effect";

type ArtifactLocaleCode = Schema.Codec.Encoded<typeof ArtifactLocaleSchema>;

/** The smallest valid content tree: a fragment with no children. */
export const TEST_CONTENT_TREE: ContentTreeElement = {
  $node: "element",
  children: [],
  name: "fragment",
  props: {},
};

/** A fragment whose only child is one text node, the tree that a text fixture carries. */
export function testTextTree(text: string): ContentTreeElement {
  return { $node: "element", children: [text], name: "fragment", props: {} };
}

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
  readonly bodyText?: string | undefined;
  readonly contentKey?: string | undefined;
  readonly contentTree?: ContentTreeElement | undefined;
  readonly plainText?: string | undefined;
  readonly rawMdx?: string | undefined;
  readonly rendererDomain?: RendererDomain | undefined;
}) {
  return encodeJsonText({
    artifactHash: options?.artifactHash ?? TEST_ARTIFACT_HASH,
    keyId: "test-key",
    payload: {
      artifactLocale: options?.artifactLocale ?? "en",
      compilerConfigHash: TEST_DIGEST,
      compilerVersion: AKSARA_COMPILER_VERSION,
      contentKey: options?.contentKey ?? "test:head-0",
      contentTree: testTree(options),
      format: "content-tree",
      mdxCompilerVersion: MDX_COMPILER_VERSION,
      plainText: options?.plainText ?? "Technical fixture",
      rawMdx: options?.rawMdx ?? "## Technical fixture",
      rendererDomain: options?.rendererDomain ?? "mathematics",
      requiredComponents: [],
      sourceHash: TEST_DIGEST,
    },
    signature: "A".repeat(86),
  });
}

/** The tree a fixture carries: an explicit tree, else its text, else the empty tree. */
export function testTree(options?: {
  readonly bodyText?: string | undefined;
  readonly contentTree?: ContentTreeElement | undefined;
}): ContentTreeElement {
  if (options?.contentTree !== undefined) {
    return options.contentTree;
  }
  return options?.bodyText === undefined
    ? TEST_CONTENT_TREE
    : testTextTree(options.bodyText);
}
