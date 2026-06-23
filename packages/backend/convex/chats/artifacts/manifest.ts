import type { LearningArtifactManifest } from "@repo/ai/schema/data";
import type { LearningArtifact } from "@repo/math/schema/artifact/schema";
import { ConvexError } from "convex/values";
import {
  LEARNING_ARTIFACT_SCHEMA_VERSION,
  MAX_LEARNING_ARTIFACT_MANIFEST_DESCRIPTION_LENGTH,
  MAX_LEARNING_ARTIFACT_MANIFEST_TITLE_LENGTH,
} from "./spec";

/**
 * Builds the retention-safe manifest stored in transcript parts.
 * Full renderable payloads stay in learningArtifacts so hot transcript reads
 * never hydrate large deterministic geometry by accident.
 */
export function buildLearningArtifactManifest(
  artifact: LearningArtifact,
  payloadBytes: number
): LearningArtifactManifest {
  return {
    artifactId: artifact.id,
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
    description: readManifestDescription(artifact.description),
    kind: artifact.kind,
    payloadBytes,
    primitiveCount: artifact.payload.primitives.length,
    schemaVersion: LEARNING_ARTIFACT_SCHEMA_VERSION,
    title: readManifestTitle(artifact.title),
  };
}

/**
 * Compares manifest fields explicitly so object-key order cannot affect writes.
 */
export function isSameManifest(
  actual: LearningArtifactManifest,
  expected: LearningArtifactManifest
) {
  return (
    actual.artifactId === expected.artifactId &&
    actual.kind === expected.kind &&
    actual.schemaVersion === expected.schemaVersion &&
    actual.title === expected.title &&
    actual.description === expected.description &&
    actual.payloadBytes === expected.payloadBytes &&
    actual.primitiveCount === expected.primitiveCount &&
    actual.bounds.x.min === expected.bounds.x.min &&
    actual.bounds.x.max === expected.bounds.x.max &&
    actual.bounds.y.min === expected.bounds.y.min &&
    actual.bounds.y.max === expected.bounds.y.max &&
    actual.bounds.z.min === expected.bounds.z.min &&
    actual.bounds.z.max === expected.bounds.z.max
  );
}

/**
 * Enforces the manifest title budget before the value enters transcript rows.
 */
function readManifestTitle(title: string) {
  const trimmed = title.trim();
  if (
    trimmed.length === 0 ||
    trimmed.length > MAX_LEARNING_ARTIFACT_MANIFEST_TITLE_LENGTH
  ) {
    throw new ConvexError({
      code: "LEARNING_ARTIFACT_MANIFEST_INVALID",
      message: "Artifact manifest title is outside the supported budget.",
    });
  }

  return trimmed;
}

/**
 * Keeps optional artifact descriptions bounded for transcript replay.
 */
function readManifestDescription(description: string | undefined) {
  if (description === undefined) {
    return;
  }

  const trimmed = description.trim();
  if (trimmed.length === 0) {
    return;
  }

  if (trimmed.length > MAX_LEARNING_ARTIFACT_MANIFEST_DESCRIPTION_LENGTH) {
    throw new ConvexError({
      code: "LEARNING_ARTIFACT_MANIFEST_INVALID",
      message: "Artifact manifest description exceeds the supported budget.",
    });
  }

  return trimmed;
}
