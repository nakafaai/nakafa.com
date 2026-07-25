import { Buffer } from "node:buffer";
import {
  createHash,
  generateKeyPairSync,
  sign as signBytes,
} from "node:crypto";
import { hashCompiledContentPayload } from "@nakafa/aksara-contracts/artifact/integrity";
import {
  CompiledContentPayloadSchema,
  canonicalizeContentArtifactSigningInput,
  SignedContentArtifactSchema,
} from "@nakafa/aksara-contracts/content";
import {
  ContentKeySchema,
  Ed25519SignatureSchema,
  GitCommitShaSchema,
  type ReleaseId,
  Sha256HashSchema,
  SigningKeyIdSchema,
} from "@nakafa/aksara-contracts/ids";
import { digestProjections } from "@nakafa/aksara-contracts/projection/digest";
import {
  type ContentReleaseManifest,
  ContentReleaseManifestSchema,
  SignedContentReleaseSchema,
} from "@nakafa/aksara-contracts/release";
import { digestItems } from "@nakafa/aksara-contracts/release/digest";
import { hashContentReleaseManifest } from "@nakafa/aksara-contracts/release/hash";
import { EMPTY_RESULT_CATALOG_DIGEST } from "@nakafa/aksara-contracts/release/result";
import { digestRollbackSnapshot } from "@nakafa/aksara-contracts/release/rollback-digest";
import { digestRoutes } from "@nakafa/aksara-contracts/release/route-digest";
import { canonicalizeContentReleaseSigningInput } from "@nakafa/aksara-contracts/release/signing";
import { inheritContentSnapshots } from "@nakafa/aksara-contracts/release/snapshot";
import type { RendererDomain } from "@nakafa/aksara-contracts/renderer/domain";
import { RENDERER_DOMAINS } from "@nakafa/aksara-contracts/renderer/domain";
import { createRendererManifest } from "@nakafa/aksara-contracts/renderer/manifest";
import {
  ContentVerificationKeyResolver,
  SigningKeyNotFoundError,
} from "@nakafa/aksara-contracts/signature/spec";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { testArtifactJson } from "@repo/backend/test/content-artifact";
import {
  TEST_DIGEST,
  TEST_MANIFEST_HASH,
  TEST_RELEASE_ID,
  testDeleteJson,
  testProjectionJson,
  testPublicationScope,
  testRollbackJson,
  testRouteJson,
  testUpsertJson,
} from "@repo/backend/test/content-release";
import { Effect, Schema, Stream } from "effect";

const keys = generateKeyPairSync("ed25519");
const digest = Schema.decodeUnknownSync(Sha256HashSchema)(TEST_DIGEST);

export const TEST_KEY_ID = SigningKeyIdSchema.make("test-key");
export const TEST_PUBLIC_KEY = keys.publicKey
  .export({ format: "pem", type: "spki" })
  .toString();

/** Creates one authenticated renderer snapshot for proof tests. */
export function testProofRenderer(
  componentName = "p",
  publishedDomains: readonly RendererDomain[] = RENDERER_DOMAINS
) {
  const components = [{ name: componentName, version: 1 }];
  return Effect.runSync(
    createRendererManifest({
      base: {
        authoringComponents: components,
        supportedComponents: components,
      },
      domains: RENDERER_DOMAINS.map((name) => ({
        authoringComponents: [],
        name,
        supportedComponents: [],
      })),
      publishedDomains,
    })
  );
}

export const TEST_PROOF_RENDERER = testProofRenderer();

/** Inserts one ordered proof row without unrelated staging orchestration. */
export async function insertProofItem(
  ctx: MutationCtx,
  index: number,
  operation: "delete" | "upsert" = "upsert",
  artifactJson = testArtifactJson({
    artifactHash: `sha256:${(index + 1).toString(16).padStart(64, "0")}`,
    contentKey: `test:head-${index}`,
  })
) {
  const contentKey = `test:head-${index}`;
  const artifactHash = `sha256:${(index + 1).toString(16).padStart(64, "0")}`;
  await ctx.db.insert("contentItems", {
    artifactHash: operation === "upsert" ? artifactHash : undefined,
    artifactReady: operation === "upsert",
    contentKey,
    index,
    itemBatchHash: TEST_MANIFEST_HASH,
    itemBatchIndex: 0,
    itemJson:
      operation === "delete"
        ? testDeleteJson({ contentKey, index })
        : testUpsertJson({ artifactHash, contentKey, index }),
    locale: "en",
    projectionJson:
      operation === "upsert"
        ? testProjectionJson({ contentKey, index })
        : undefined,
    projectionReady: operation === "upsert",
    releaseId: TEST_RELEASE_ID,
    rollbackJson: testRollbackJson({ contentKey, index }),
    sequence: 1,
    stagedAt: 1,
  });
  if (operation === "upsert") {
    await ctx.db.insert("contentArtifacts", {
      artifactHash,
      artifactJson,
      createdAt: 1,
      retainUntil: Number.MAX_SAFE_INTEGER,
    });
  }
}

/** Inserts one ordered route proof row. */
export function insertProofRoute(ctx: MutationCtx, index: number) {
  const contentKey = `test:head-${index}`;
  const publicPath = `test/head-${index}`;
  return ctx.db.insert("contentBindings", {
    batchHash: TEST_MANIFEST_HASH,
    batchIndex: 0,
    contentKey,
    index,
    locale: "en",
    operation: "bind",
    publicPath,
    releaseId: TEST_RELEASE_ID,
    routeJson: testRouteJson({ contentKey, index, publicPath }),
    sequence: 1,
  });
}

/** Creates an authenticated empty manifest with every catalog proof bound. */
export function testEmptyManifest(releaseId: ReleaseId) {
  const items = Effect.runSync(digestItems(releaseId, Stream.empty));
  const projections = Effect.runSync(
    digestProjections(releaseId, Stream.empty)
  );
  const rollback = Effect.runSync(
    digestRollbackSnapshot(releaseId, Stream.empty)
  );
  const routes = Effect.runSync(digestRoutes(releaseId, Stream.empty));
  const snapshots = inheritContentSnapshots(null);
  return ContentReleaseManifestSchema.make({
    baseManifestHash: null,
    baseReleaseId: null,
    baseResultCount: 0,
    baseResultDigest: EMPTY_RESULT_CATALOG_DIGEST,
    deleteCount: 0,
    itemCount: 0,
    itemsDigest: items.digest,
    origin: { kind: "git", sha: GitCommitShaSchema.make("a".repeat(40)) },
    projectionCount: 0,
    projectionDigest: projections.digest,
    releaseId,
    rendererContractVersion: TEST_PROOF_RENDERER.rendererContractVersion,
    rendererManifestHash: TEST_PROOF_RENDERER.hash,
    resultCount: 0,
    resultDigest: EMPTY_RESULT_CATALOG_DIGEST,
    rollbackCount: 0,
    rollbackDigest: rollback.digest,
    routeCount: 0,
    routeDigest: routes.digest,
    scope: testPublicationScope({ snapshots }),
    snapshots,
    upsertCount: 0,
  });
}

export const TEST_KEY_RESOLVER = ContentVerificationKeyResolver.of({
  /** Resolves only the explicit technical test key. */
  resolve: (requestedKeyId) => {
    if (requestedKeyId === TEST_KEY_ID) {
      return Effect.succeed(TEST_PUBLIC_KEY);
    }
    return Effect.fail(new SigningKeyNotFoundError({ keyId: requestedKeyId }));
  },
});

/** Produces one fully authenticated technical artifact. */
export function testSignedArtifact(
  rendererDomain: RendererDomain = "mathematics",
  options?: {
    readonly compiledCode?: string;
    readonly contentKey?: string;
    readonly locale?: "en" | "id";
    readonly plainText?: string;
    readonly rawMdx?: string;
  }
) {
  const rawMdx = options?.rawMdx ?? "## Technical proof";
  const compiledCode = options?.compiledCode ?? "return {};";
  const payload = CompiledContentPayloadSchema.make({
    byteLength: Buffer.byteLength(compiledCode, "utf8"),
    compiledCode,
    compilerConfigHash: digest,
    compilerVersion: "0.1.0",
    contentKey: ContentKeySchema.make(options?.contentKey ?? "test:head-0"),
    format: "mdx-function-body-v1",
    locale: options?.locale ?? "en",
    mdxCompilerVersion: "3.1.1",
    plainText: options?.plainText ?? "Technical proof",
    rawMdx,
    rendererDomain,
    requiredComponents: [],
    sourceHash: Sha256HashSchema.make(
      `sha256:${createHash("sha256").update(rawMdx).digest("hex")}`
    ),
  });
  const artifactHash = hashCompiledContentPayload(payload);
  return SignedContentArtifactSchema.make({
    artifactHash,
    keyId: TEST_KEY_ID,
    payload,
    signature: Ed25519SignatureSchema.make(
      signBytes(
        null,
        Buffer.from(
          canonicalizeContentArtifactSigningInput(artifactHash, payload),
          "utf8"
        ),
        keys.privateKey
      ).toString("base64url")
    ),
  });
}

/** Produces one fully authenticated technical release envelope. */
export function testSignedRelease(manifest: ContentReleaseManifest) {
  const manifestHash = Effect.runSync(hashContentReleaseManifest(manifest));
  return SignedContentReleaseSchema.make({
    keyId: TEST_KEY_ID,
    manifest,
    manifestHash,
    signature: Ed25519SignatureSchema.make(
      signBytes(
        null,
        Buffer.from(
          canonicalizeContentReleaseSigningInput(manifestHash, manifest),
          "utf8"
        ),
        keys.privateKey
      ).toString("base64url")
    ),
  });
}
