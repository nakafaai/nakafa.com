import { EMPTY_RESULT_CATALOG_DIGEST } from "@nakafa/aksara-contracts/release/result";
import { Effect } from "effect";
import { rendererManifest } from "@/lib/content/renderer/manifest";
import {
  previewArtifactHash,
  previewKeyId,
  previewManifestHash,
  previewProjection,
  previewSourcePath,
  previewWireArtifact,
} from "@/test/content-preview";

/** Builds one structurally complete found response for transport decoding. */
export async function createRuntimeFoundBody() {
  const currentRenderer = await Effect.runPromise(rendererManifest);
  const release = {
    keyId: previewKeyId,
    manifest: {
      baseManifestHash: null,
      baseReleaseId: null,
      baseResultCount: 0,
      baseResultDigest: EMPTY_RESULT_CATALOG_DIGEST,
      deleteCount: 0,
      itemCount: 1,
      itemsDigest: previewArtifactHash,
      origin: { kind: "git", sha: "a".repeat(40) },
      projectionCount: 1,
      projectionDigest: previewArtifactHash,
      releaseId: "release-function-concept",
      rendererContractVersion: "1.0.0",
      rendererManifestHash: currentRenderer.hash,
      resultCount: 1,
      resultDigest: previewArtifactHash,
      rollbackCount: 1,
      rollbackDigest: previewArtifactHash,
      routeCount: 1,
      routeDigest: previewArtifactHash,
      upsertCount: 1,
    },
    manifestHash: previewManifestHash,
    signature: previewWireArtifact.signature,
  };

  return JSON.stringify({
    activeManifestHash: release.manifestHash,
    activeReleaseId: release.manifest.releaseId,
    artifact: previewWireArtifact,
    delivery: "public",
    kind: "found",
    projection: previewProjection,
    projectionHash: previewArtifactHash,
    release,
    rendererManifest: currentRenderer,
    sourcePath: previewSourcePath,
  });
}
