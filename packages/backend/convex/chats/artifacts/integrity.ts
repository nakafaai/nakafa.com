import {
  isSameLearningArtifactManifest,
  type LearningArtifactManifest,
} from "@repo/ai/schema/artifact";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
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

    if (artifact.chatId !== message.chatId) {
      issues.push({
        artifactId: artifact.artifactId,
        messageId: artifact.messageId,
        partOrder: artifact.partOrder,
        reason: "Artifact row chat does not match its owning message.",
      });
      continue;
    }

    const parts = await ctx.db
      .query("parts")
      .withIndex("by_messageId_and_order", (q) =>
        q.eq("messageId", artifact.messageId).eq("order", artifact.partOrder)
      )
      .take(2);

    if (parts.length > 1) {
      issues.push({
        artifactId: artifact.artifactId,
        messageId: artifact.messageId,
        partOrder: artifact.partOrder,
        reason: "Artifact manifest part order is duplicated.",
      });
      continue;
    }

    const part = parts[0];
    if (!(part && part.type === "data-artifact" && part.dataArtifactData)) {
      issues.push({
        artifactId: artifact.artifactId,
        messageId: artifact.messageId,
        partOrder: artifact.partOrder,
        reason: "Artifact manifest part is missing.",
      });
      continue;
    }

    if (
      part.dataArtifactId !== artifact.artifactId ||
      !isSameLearningArtifactManifest(
        part.dataArtifactData,
        readStoredArtifactManifest(artifact)
      )
    ) {
      issues.push({
        artifactId: artifact.artifactId,
        messageId: artifact.messageId,
        partOrder: artifact.partOrder,
        reason: "Artifact manifest fields do not match the payload row.",
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

    if (part.dataArtifactId !== manifest.artifactId) {
      issues.push({
        artifactId: manifest.artifactId,
        messageId: part.messageId,
        partOrder: part.order,
        reason: "Data artifact part id does not match its manifest.",
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
      artifact.partOrder !== part.order ||
      !isSameLearningArtifactManifest(
        manifest,
        readStoredArtifactManifest(artifact)
      )
    ) {
      issues.push({
        artifactId: manifest.artifactId,
        messageId: part.messageId,
        partOrder: part.order,
        reason: "Data artifact manifest does not match its payload row.",
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
 * Rebuilds the transcript manifest from the durable artifact row fields.
 */
function readStoredArtifactManifest(
  artifact: Doc<"learningArtifacts">
): LearningArtifactManifest {
  return {
    artifactId: artifact.artifactId,
    bounds: {
      x: {
        max: artifact.payload.axes.x[1].expression,
        min: artifact.payload.axes.x[0].expression,
      },
      y: {
        max: artifact.payload.axes.y[1].expression,
        min: artifact.payload.axes.y[0].expression,
      },
      z: {
        max: artifact.payload.axes.z[1].expression,
        min: artifact.payload.axes.z[0].expression,
      },
    },
    ...(artifact.description ? { description: artifact.description } : {}),
    kind: artifact.kind,
    payloadBytes: artifact.payloadBytes,
    primitiveCount: artifact.primitiveCount,
    schemaVersion: artifact.schemaVersion,
    title: artifact.title,
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
