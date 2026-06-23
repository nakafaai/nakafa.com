import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import type { Infer } from "convex/values";
import type { artifactIntegrityIssueValidator } from "./spec";

const ARTIFACT_INTEGRITY_PAGE_LIMIT = 50;
type ArtifactIntegrityIssue = Infer<typeof artifactIntegrityIssueValidator>;

/**
 * Checks artifact payload rows against their owning message part manifests.
 * Pagination keeps integrity proof safe for large production deployments.
 */
export async function checkPayloadIntegrityPage(
  ctx: QueryCtx,
  paginationOpts: { cursor: string | null; numItems: number }
) {
  const page = await ctx.db
    .query("learningArtifacts")
    .paginate(readIntegrityPaginationOpts(paginationOpts));
  const issues: ArtifactIntegrityIssue[] = [];

  for (const artifact of page.page) {
    const message = await ctx.db.get(artifact.messageId);
    if (!message) {
      issues.push({
        artifactId: artifact.artifactId,
        messageId: artifact.messageId,
        partOrder: artifact.partOrder,
        reason: "Artifact message is missing.",
      });
      continue;
    }

    const part = await ctx.db
      .query("parts")
      .withIndex("by_messageId_and_order", (q) =>
        q.eq("messageId", artifact.messageId).eq("order", artifact.partOrder)
      )
      .unique();

    if (!(part && part.type === "data-artifact" && part.dataArtifactData)) {
      issues.push({
        artifactId: artifact.artifactId,
        messageId: artifact.messageId,
        partOrder: artifact.partOrder,
        reason: "Artifact manifest part is missing.",
      });
      continue;
    }

    if (part.dataArtifactData.artifactId !== artifact.artifactId) {
      issues.push({
        artifactId: artifact.artifactId,
        messageId: artifact.messageId,
        partOrder: artifact.partOrder,
        reason: "Artifact manifest points to a different payload.",
      });
    }
  }

  return {
    checked: page.page.length,
    cursor: page.continueCursor,
    isDone: page.isDone,
    issues,
  };
}

/**
 * Checks manifest parts against durable artifact payload rows.
 * The scan uses the part-type index, so it never filters an unbounded table.
 */
export async function checkManifestIntegrityPage(
  ctx: QueryCtx,
  paginationOpts: { cursor: string | null; numItems: number }
) {
  const page = await ctx.db
    .query("parts")
    .withIndex("by_type", (q) => q.eq("type", "data-artifact"))
    .paginate(readIntegrityPaginationOpts(paginationOpts));
  const issues: ArtifactIntegrityIssue[] = [];

  for (const part of page.page) {
    const manifest = part.dataArtifactData;
    if (!manifest) {
      issues.push({
        messageId: part.messageId,
        partOrder: part.order,
        reason: "Data artifact part has no manifest.",
      });
      continue;
    }

    const artifacts = await ctx.db
      .query("learningArtifacts")
      .withIndex("by_artifactId", (q) =>
        q.eq("artifactId", manifest.artifactId)
      )
      .take(2);

    if (artifacts.length !== 1) {
      issues.push({
        artifactId: manifest.artifactId,
        messageId: part.messageId,
        partOrder: part.order,
        reason: "Data artifact manifest does not resolve to one payload.",
      });
      continue;
    }

    const artifact = artifacts[0];
    if (
      artifact.messageId !== part.messageId ||
      artifact.partOrder !== part.order
    ) {
      issues.push({
        artifactId: manifest.artifactId,
        messageId: part.messageId,
        partOrder: part.order,
        reason: "Data artifact manifest resolves to the wrong message part.",
      });
    }
  }

  return {
    checked: page.page.length,
    cursor: page.continueCursor,
    isDone: page.isDone,
    issues,
  };
}

/**
 * Caps integrity checks even if callers request an oversized page.
 */
function readIntegrityPaginationOpts(paginationOpts: {
  cursor: string | null;
  numItems: number;
}) {
  return {
    cursor: paginationOpts.cursor,
    numItems: Math.min(paginationOpts.numItems, ARTIFACT_INTEGRITY_PAGE_LIMIT),
  };
}
