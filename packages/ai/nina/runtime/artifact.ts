import {
  encodeLearningArtifactWrite,
  type LearningArtifactWrite,
} from "@repo/ai/schema/artifact";
import type { MyUIMessage } from "@repo/ai/types/message";
import type { LearningArtifact } from "@repo/math/schema/artifact/schema";
import { Effect } from "effect";

/**
 * Pairs manifest-only streamed parts with full workspace artifact payloads.
 * Convex persistence still enforces exact one-for-one coverage, so any missing
 * payload fails closed instead of writing a transcript pointer to nothing.
 */
export const readArtifactWritesForMessage = Effect.fn(
  "nina.runtime.readArtifactWrites"
)(function* ({
  artifacts,
  message,
}: {
  readonly artifacts: readonly LearningArtifact[];
  readonly message: MyUIMessage;
}) {
  if (artifacts.length === 0) {
    return [];
  }

  const artifactById = new Map(
    artifacts.map((artifact) => [artifact.id, artifact])
  );
  const writes: LearningArtifactWrite[] = [];

  for (const [partOrder, part] of message.parts.entries()) {
    if (part.type !== "data-artifact") {
      continue;
    }

    const artifact = artifactById.get(part.data.artifactId);
    if (!artifact) {
      continue;
    }

    const write = yield* encodeLearningArtifactWrite({
      artifact,
      partOrder,
    });

    writes.push(write);
  }

  return writes;
});
