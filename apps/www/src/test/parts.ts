import type { ContentFamily } from "@nakafa/aksara-contracts/content";
import type { PublicContentRuntimeFound } from "@nakafa/aksara-contracts/runtime/spec";
import { encodeJsonText } from "@repo/utilities/json";

/**
 * The Convex answers that one found response is composed from: the route's head,
 * the release's signed frame, and the artifact's text, as the reader receives them.
 */
export function makePublishedParts(
  found: PublicContentRuntimeFound,
  family: ContentFamily
) {
  return {
    artifactJson: encodeJsonText(found.artifact),
    frame: {
      activeManifestHash: found.activeManifestHash,
      activeReleaseId: found.activeReleaseId,
      releaseJson: encodeJsonText(found.release),
      rendererJson: encodeJsonText(found.rendererManifest),
    },
    head: {
      activeReleaseId: found.activeReleaseId,
      artifactHash: found.artifact.artifactHash,
      family,
      projectionHash: found.projectionHash,
      projectionJson: encodeJsonText(found.projection),
      sourcePath: found.sourcePath,
    },
  };
}
