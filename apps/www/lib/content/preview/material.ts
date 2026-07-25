import "server-only";

import type { SigningKeyId } from "@nakafa/aksara-contracts/ids";
import { MAX_SIGNED_ARTIFACT_BYTES } from "@nakafa/aksara-contracts/limits";
import type { MaterialPreviewDocument } from "@nakafa/aksara-contracts/preview/document";
import type { LocalPreviewManifest } from "@nakafa/aksara-contracts/preview/spec";
import {
  MaterialLessonProjectionSchema,
  type MaterialMetadata,
} from "@nakafa/aksara-contracts/projection/material";
import type { RendererManifestEnvelope } from "@nakafa/aksara-contracts/renderer/contract";
import {
  ContentVerificationKeyResolver,
  SigningKeyNotFoundError,
} from "@nakafa/aksara-contracts/signature/spec";
import type { PublicContentRoute } from "@repo/contents/_types/route/schema";
import { mathematicsComponents } from "@repo/design-system/lib/markdown/domain/mathematics";
import { Effect, Option, Schema } from "effect";
import type { PreviewConfig } from "@/lib/content/preview/config";
import {
  PreviewCompileError,
  PreviewIntegrityError,
  PreviewPendingError,
} from "@/lib/content/preview/errors";
import { readPreviewSnapshot } from "@/lib/content/preview/manifest";
import { fetchPreviewJson } from "@/lib/content/preview/request";
import {
  decodeMaterialPreviewRoute,
  type MaterialPreviewRouteInput,
  matchesMaterialPreviewRoute,
} from "@/lib/content/preview/route";
import {
  executeSignedArtifact,
  type RenderableContent,
} from "@/lib/content/published/artifact";
import { rendererManifest } from "@/lib/content/renderer/manifest";

/** Exact material route identity requested by one Next server boundary. */
export type MaterialPreviewInput = MaterialPreviewRouteInput;

/** Authenticated local body plus metadata rendered by the actual Nakafa app. */
export interface MaterialPreviewContent {
  readonly Content: RenderableContent["Content"];
  readonly locale: MaterialPreviewDocument["route"]["locale"];
  readonly metadata: MaterialMetadata;
  readonly rawMdx: string;
  readonly rendererDomain: "mathematics";
  readonly route: PublicContentRoute;
}

/** Confirms the authenticated renderer before evaluating one ready artifact. */
function validateRenderer(
  manifest: Extract<LocalPreviewManifest, { readonly status: "ready" }>,
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

/** Authenticates and executes the exact ready material artifact. */
const readReadyContent = Effect.fn("NakafaContent.readReadyPreview")(function* (
  manifest: Extract<LocalPreviewManifest, { readonly status: "ready" }>,
  document: MaterialPreviewDocument,
  config: PreviewConfig
) {
  const previewArtifact = manifest.artifacts[0];
  const projection = Schema.decodeUnknownSync(MaterialLessonProjectionSchema)(
    previewArtifact.projection
  );

  const activeManifest = yield* rendererManifest;
  yield* validateRenderer(manifest, activeManifest);
  const route = yield* decodeMaterialPreviewRoute(projection);
  const artifact = yield* fetchPreviewJson(
    config,
    previewArtifact.artifactPath,
    MAX_SIGNED_ARTIFACT_BYTES
  );
  const rendered = yield* executeSignedArtifact({
    artifact,
    components: mathematicsComponents,
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
  return {
    Content: rendered.Content,
    locale: projection.locale,
    metadata: projection.metadata,
    rawMdx: rendered.artifact.payload.rawMdx,
    rendererDomain: "mathematics",
    route,
  } satisfies MaterialPreviewContent;
});

/** Reads a matching changed material route or leaves unchanged routes alone. */
export const readMaterialPreview = Effect.fn(
  "NakafaContent.readMaterialPreview"
)(function* (input: MaterialPreviewInput) {
  const snapshot = yield* readPreviewSnapshot();
  if (Option.isNone(snapshot)) {
    return Option.none<MaterialPreviewContent>();
  }
  const { config, manifest } = snapshot.value;
  const document = manifest.document;
  if (document.family !== "material") {
    return Option.none<MaterialPreviewContent>();
  }
  if (!matchesMaterialPreviewRoute(manifest, input)) {
    return Option.none<MaterialPreviewContent>();
  }
  if (document.rendererDomain !== "mathematics") {
    return yield* new PreviewIntegrityError({ check: "domain" });
  }
  if (manifest.status === "pending") {
    return yield* new PreviewPendingError({ revision: manifest.revision });
  }
  if (manifest.status === "failed") {
    return yield* new PreviewCompileError({
      code: manifest.failure.code,
      message: manifest.failure.message,
      revision: manifest.revision,
    });
  }
  return Option.some(yield* readReadyContent(manifest, document, config));
});
