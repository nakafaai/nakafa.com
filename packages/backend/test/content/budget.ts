import { MAX_SIGNED_ARTIFACT_BYTES } from "@nakafa/aksara-contracts/limits";
import {
  CONTENT_DOCUMENT_LIMIT,
  READ_MODEL_DOCUMENT_LIMIT,
} from "@repo/backend/confect/contentRelease/document";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { testArtifactJson } from "@repo/backend/test/content/artifact";
import { testProjectionJson } from "@repo/backend/test/content/material";
import {
  TEST_DIGEST,
  testRollbackJson,
  testUpsertJson,
} from "@repo/backend/test/content/release";
import { getDocumentSize, type Value } from "convex/values";
import { Array as Arr, Schema } from "effect";

/** One stored version or item naming an artifact at a release sequence. */
const ArtifactRowSchema = Schema.Struct({
  artifactHash: Schema.String,
  contentKey: Schema.String,
  index: Schema.Finite,
  sequence: Schema.Finite,
});
type ArtifactRow = typeof ArtifactRowSchema.Type;

/** Insignificant JSON whitespace filling one row to one byte below a ceiling. */
export function ceilingPadding(limit: number, row: Record<string, Value>) {
  return " ".repeat(limit - 1 - getDocumentSize(row));
}

/** Builds one row whose padded JSON fills it to one byte below a ceiling. */
function fill<Row extends Record<string, Value>>(
  limit: number,
  build: (padding: string) => Row
) {
  return build(ceilingPadding(limit, build("")));
}

/** Creates one signed artifact at the largest wire size Aksara accepts. */
export function ceilingArtifactJson(artifactHash: string) {
  const json = (length: number) =>
    testArtifactJson({ artifactHash, bodyText: "x".repeat(length) });
  // Six-digit code lengths keep the byte length's width, so every extra code
  // byte adds exactly one wire byte.
  const base = 100_000;
  return json(base + MAX_SIGNED_ARTIFACT_BYTES - json(base).length);
}

/** Inserts one immutable content version at the read-model ceiling. */
export function insertCeilingHead(ctx: MutationCtx, head: ArtifactRow) {
  return ctx.db.insert(
    "contentHeads",
    fill(READ_MODEL_DOCUMENT_LIMIT, (padding) => ({
      artifactHash: head.artifactHash,
      artifactLocale: "en",
      compilerConfigHash: TEST_DIGEST,
      contentKey: head.contentKey,
      delivery: "public",
      family: "material",
      index: head.index,
      operation: "upsert",
      projectionHash: TEST_DIGEST,
      projectionJson: `${testProjectionJson({
        contentKey: head.contentKey,
        index: head.index,
      })}${padding}`,
      releaseId: `release-${head.sequence}`,
      rendererDomain: "mathematics",
      sequence: head.sequence,
      sourceHash: TEST_DIGEST,
      sourcePath: `packages/corpus/test/${head.contentKey}/en.mdx`,
    }))
  );
}

/** Inserts one artifact-ready release item filled to a document ceiling. */
export function insertCeilingItem(
  ctx: MutationCtx,
  item: ArtifactRow,
  limit = CONTENT_DOCUMENT_LIMIT
) {
  const { artifactHash, contentKey, index } = item;
  const releaseId = `release-${item.sequence}`;
  return ctx.db.insert(
    "contentItems",
    fill(limit, (padding) => ({
      artifactBatchHash: TEST_DIGEST,
      artifactBatchIndex: 0,
      artifactHash,
      artifactLocale: "en",
      artifactReady: true,
      contentKey,
      index,
      itemBatchHash: TEST_DIGEST,
      itemBatchIndex: 0,
      itemJson: testUpsertJson({ artifactHash, contentKey, index, releaseId }),
      projectionBatchHash: TEST_DIGEST,
      projectionBatchIndex: 0,
      projectionJson: `${testProjectionJson({ contentKey, index })}${padding}`,
      projectionReady: true,
      releaseId,
      rollbackJson: testRollbackJson({ contentKey, index, releaseId }),
      sequence: item.sequence,
      stagedAt: 0,
    }))
  );
}

/** Keeps every artifact reachable through the largest rows that may name it. */
export async function insertCeilingReferences(
  ctx: MutationCtx,
  artifactHashes: readonly ArtifactRow["artifactHash"][],
  sequence: number
) {
  const references = Arr.map(artifactHashes, (artifactHash, index) => ({
    artifactHash,
    contentKey: `test:reference-${index}`,
    index,
    sequence,
  }));
  for (const reference of references) {
    await insertCeilingHead(ctx, reference);
    await insertCeilingItem(ctx, reference);
  }
}

/** Returns the bytes one mutation transaction has read so far. */
export async function transactionBytes(ctx: MutationCtx) {
  const metrics = await ctx.meta.getTransactionMetrics();
  return metrics.bytesRead.used;
}
