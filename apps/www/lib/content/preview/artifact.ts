import "server-only";

import type { SigningKeyId } from "@nakafa/aksara-contracts/ids";
import { MAX_SIGNED_ARTIFACT_BYTES } from "@nakafa/aksara-contracts/limits";
import type { PreviewDocument } from "@nakafa/aksara-contracts/preview/document";
import type { LocalPreviewManifest } from "@nakafa/aksara-contracts/preview/spec";
import type { ContentProjection } from "@nakafa/aksara-contracts/projection/spec";
import type { RendererManifestEnvelope } from "@nakafa/aksara-contracts/renderer/contract";
import {
  ContentVerificationKeyResolver,
  SigningKeyNotFoundError,
} from "@nakafa/aksara-contracts/signature/spec";
import { Effect } from "effect";
import type { PreviewConfig } from "@/lib/content/preview/config";
import { PreviewIntegrityError } from "@/lib/content/preview/errors";
import { fetchPreviewJson } from "@/lib/content/preview/request";
import { executeSignedArtifact } from "@/lib/content/published/artifact";
import { getRendererComponents } from "@/lib/content/renderer/components";
import { rendererManifest } from "@/lib/content/renderer/manifest";

type ReadyPreviewManifest = Extract<
  LocalPreviewManifest,
  { readonly status: "ready" }
>;

/** Confirms the provider compiled against the renderer running this app. */
function validateRenderer(
  manifest: ReadyPreviewManifest,
  activeManifest: RendererManifestEnvelope
) {
  if (manifest.rendererManifestHash !== activeManifest.hash) {
    return Effect.fail(new PreviewIntegrityError({ check: "renderer" }));
  }

  return Effect.void;
}

/** Builds the one-key trust resolver owned by this ephemeral preview child. */
function makeKeyResolver(keyId: SigningKeyId, publicKey: string) {
  return {
    /** Resolves only the exact ephemeral key advertised to the child process. */
    resolve: (requested: SigningKeyId) =>
      requested === keyId
        ? Effect.succeed(publicKey)
        : Effect.fail(new SigningKeyNotFoundError({ keyId: requested })),
  };
}

/** Authenticates and executes one routed artifact through its real registry. */
export const executePreviewArtifact = Effect.fn(
  "NakafaContent.executePreviewArtifact"
)(function* ({
  config,
  document,
  manifest,
  projection,
}: {
  readonly config: PreviewConfig;
  readonly document: PreviewDocument;
  readonly manifest: ReadyPreviewManifest;
  readonly projection: ContentProjection;
}) {
  const previewArtifact = manifest.artifacts[0];
  const activeManifest = yield* rendererManifest;
  yield* validateRenderer(manifest, activeManifest);

  const artifact = yield* fetchPreviewJson(
    config,
    previewArtifact.artifactPath,
    MAX_SIGNED_ARTIFACT_BYTES
  );
  const rendered = yield* executeSignedArtifact({
    artifact,
    components: getRendererComponents(document.rendererDomain),
    rendererContractVersion: activeManifest.rendererContractVersion,
    rendererManifest: activeManifest,
  }).pipe(
    Effect.provideService(
      ContentVerificationKeyResolver,
      makeKeyResolver(config.keyId, config.publicKey)
    )
  );

  if (
    rendered.artifact.artifactHash !== previewArtifact.artifactHash ||
    rendered.artifact.payload.contentKey !== projection.contentKey ||
    rendered.artifact.payload.locale !== projection.locale ||
    rendered.artifact.payload.rendererDomain !== document.rendererDomain
  ) {
    return yield* new PreviewIntegrityError({ check: "artifact" });
  }

  return rendered;
});
