import {
  buildLearningArtifactManifest,
  type LearningArtifactManifest,
} from "@repo/ai/schema/artifact";
import type { MyUIMessage } from "@repo/ai/types/message";
import type { LearningArtifact } from "@repo/math/schema/artifact/schema";
import type { UIMessageStreamWriter } from "ai";
import { Effect } from "effect";

/**
 * Writes manifest-only artifact parts after specialist generation succeeds.
 */
export const emitLearningArtifacts = Effect.fn("math.artifact.emit")(
  function* ({
    artifacts,
    writer,
  }: {
    readonly artifacts: readonly LearningArtifact[];
    readonly writer: Pick<UIMessageStreamWriter<MyUIMessage>, "write">;
  }) {
    if (artifacts.length === 0) {
      return [];
    }

    const manifests: {
      readonly artifact: LearningArtifact;
      readonly manifest: LearningArtifactManifest;
    }[] = [];
    for (const artifact of artifacts) {
      const manifest = yield* buildLearningArtifactManifest(artifact);
      manifests.push({ artifact, manifest });
    }

    for (const { artifact, manifest } of manifests) {
      yield* Effect.sync(() =>
        writer.write({
          data: manifest,
          id: artifact.id,
          type: "data-artifact",
        })
      );
    }

    return artifacts;
  }
);
