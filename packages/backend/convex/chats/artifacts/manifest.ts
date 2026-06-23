import {
  isSameLearningArtifactManifest,
  type LearningArtifactManifest,
} from "@repo/ai/schema/artifact";
import type { partValidator } from "@repo/backend/convex/chats/schema";
import { ConvexError, type Infer } from "convex/values";
import type { DecodedLearningArtifactWrite } from "./write";

type PersistedPartInput = Omit<Infer<typeof partValidator>, "messageId">;

/**
 * Indexes artifact payload writes by the part order they must accompany.
 */
export function readArtifactWritesByOrder(
  artifacts: readonly DecodedLearningArtifactWrite[]
) {
  const artifactByOrder = new Map<number, DecodedLearningArtifactWrite>();
  for (const artifact of artifacts) {
    assertPartOrder(artifact.partOrder);
    if (artifactByOrder.has(artifact.partOrder)) {
      throw new ConvexError({
        code: "LEARNING_ARTIFACT_DUPLICATE_PART_ORDER",
        message: "Artifact write contains duplicate part orders.",
      });
    }

    artifactByOrder.set(artifact.partOrder, artifact);
  }

  return artifactByOrder;
}

/**
 * Reads artifact manifests from already-flattened message parts by part order.
 */
export function readArtifactManifestsByOrder(
  parts: readonly PersistedPartInput[]
) {
  const manifestByOrder = new Map<number, LearningArtifactManifest>();
  for (const part of parts) {
    if (part.type !== "data-artifact") {
      continue;
    }

    assertPartOrder(part.order);
    if (!part.dataArtifactData) {
      throw new ConvexError({
        code: "LEARNING_ARTIFACT_MANIFEST_MISSING",
        message: "Data artifact part is missing its manifest.",
      });
    }

    if (part.dataArtifactId !== part.dataArtifactData.artifactId) {
      throw new ConvexError({
        code: "LEARNING_ARTIFACT_MANIFEST_ID_MISMATCH",
        message: "Data artifact part id must match its manifest artifact id.",
      });
    }

    if (manifestByOrder.has(part.order)) {
      throw new ConvexError({
        code: "LEARNING_ARTIFACT_DUPLICATE_PART_ORDER",
        message: "Artifact manifests contain duplicate part orders.",
      });
    }

    manifestByOrder.set(part.order, part.dataArtifactData);
  }

  return manifestByOrder;
}

/**
 * Ensures every artifact payload has one matching manifest and no orphan part.
 */
export function assertArtifactManifestCoverage(
  artifactByOrder: ReadonlyMap<number, DecodedLearningArtifactWrite>,
  manifestByOrder: ReadonlyMap<number, LearningArtifactManifest>
) {
  if (artifactByOrder.size !== manifestByOrder.size) {
    throw new ConvexError({
      code: "LEARNING_ARTIFACT_MANIFEST_MISMATCH",
      message: "Artifact payloads and manifests must match one-for-one.",
    });
  }

  for (const order of manifestByOrder.keys()) {
    if (!artifactByOrder.has(order)) {
      throw new ConvexError({
        code: "LEARNING_ARTIFACT_PAYLOAD_MISSING",
        message: "Data artifact manifest has no durable payload.",
      });
    }
  }
}

/**
 * Validates persisted part ordering before using it as an artifact join key.
 */
export function assertPartOrder(order: number) {
  const error = readPartOrderError(order);
  if (error) {
    throw error;
  }
}

/**
 * Builds the part-order failure without throwing inside Effect programs.
 */
export function readPartOrderError(order: number) {
  return Number.isSafeInteger(order) && order >= 0
    ? undefined
    : new ConvexError({
        code: "LEARNING_ARTIFACT_PART_ORDER_INVALID",
        message: "Artifact part order must be a non-negative safe integer.",
      });
}

/**
 * Compares a stored manifest with the freshly built deterministic manifest.
 */
export function isMatchingArtifactManifest(
  stored: LearningArtifactManifest | undefined,
  expected: LearningArtifactManifest
) {
  return stored ? isSameLearningArtifactManifest(stored, expected) : false;
}
