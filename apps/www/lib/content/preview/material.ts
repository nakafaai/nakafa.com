import "server-only";

import type { SigningKeyId } from "@nakafa/aksara-contracts/ids";
import { MAX_SIGNED_ARTIFACT_BYTES } from "@nakafa/aksara-contracts/limits";
import type { LocalPreviewManifest } from "@nakafa/aksara-contracts/preview/spec";
import type { MaterialMetadata } from "@nakafa/aksara-contracts/projection/material";
import type { RendererManifestEnvelope } from "@nakafa/aksara-contracts/renderer/contract";
import {
  ContentVerificationKeyResolver,
  SigningKeyNotFoundError,
} from "@nakafa/aksara-contracts/signature/spec";
import type { MDXComponents } from "@repo/design-system/types/markdown";
import { Effect, Either, Option } from "effect";
import {
  type MaterialRuntimeResolver,
  type ResolvedMaterialRoute,
  resolveMaterialRuntime,
} from "@/lib/content/material";
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
export interface MaterialPreviewInput extends MaterialPreviewRouteInput {
  readonly resolveRuntime: MaterialRuntimeResolver;
}

/** Authenticated local body plus metadata rendered by the actual Nakafa app. */
export interface MaterialPreviewContent extends ResolvedMaterialRoute {
  readonly Content: RenderableContent["Content"];
  readonly metadata: MaterialMetadata;
  readonly rawMdx: string;
}

/** Confirms the ready projection and selected document share one identity. */
function validateProjection(
  manifest: Extract<LocalPreviewManifest, { readonly status: "ready" }>
) {
  const route = manifest.document.route;
  const projection = manifest.projection;
  if (
    projection.contentKey !== route.contentKey ||
    projection.locale !== route.locale ||
    projection.materialKey !== route.materialKey ||
    projection.order !== route.order ||
    projection.publicPath !== route.publicPath ||
    projection.sectionKey !== route.sectionKey
  ) {
    return Effect.fail(new PreviewIntegrityError({ check: "projection" }));
  }
  return Effect.void;
}

/** Confirms the authenticated renderer and ready projection before evaluation. */
function validateReadyManifest(
  manifest: Extract<LocalPreviewManifest, { readonly status: "ready" }>,
  activeManifest: RendererManifestEnvelope
) {
  if (manifest.rendererManifestHash !== activeManifest.hash) {
    return Effect.fail(new PreviewIntegrityError({ check: "renderer" }));
  }

  return validateProjection(manifest);
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
  config: PreviewConfig,
  components: MDXComponents
) {
  const activeManifest = yield* rendererManifest;
  yield* validateReadyManifest(manifest, activeManifest);
  const route = yield* decodeMaterialPreviewRoute(manifest);
  const artifact = yield* fetchPreviewJson(
    config,
    manifest.artifactPath,
    MAX_SIGNED_ARTIFACT_BYTES
  );
  const rendered = yield* executeSignedArtifact({
    artifact,
    components,
    rendererContractVersion: activeManifest.rendererContractVersion,
    rendererManifest: activeManifest,
  }).pipe(
    Effect.provideService(
      ContentVerificationKeyResolver,
      makeKeyResolver(config.keyId, config.publicKey)
    )
  );
  if (
    rendered.artifact.artifactHash !== manifest.artifactHash ||
    rendered.artifact.payload.contentKey !== manifest.projection.contentKey ||
    rendered.artifact.payload.locale !== manifest.projection.locale ||
    rendered.artifact.payload.rendererDomain !==
      manifest.document.rendererDomain
  ) {
    return yield* new PreviewIntegrityError({ check: "artifact" });
  }
  return {
    Content: rendered.Content,
    locale: manifest.projection.locale,
    metadata: manifest.projection.metadata,
    rawMdx: rendered.artifact.payload.rawMdx,
    rendererDomain: manifest.document.rendererDomain,
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
  if (!matchesMaterialPreviewRoute(manifest, input)) {
    return Option.none<MaterialPreviewContent>();
  }
  if (manifest.document.delivery !== "public") {
    return yield* new PreviewIntegrityError({ check: "delivery" });
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
  const runtime = resolveMaterialRuntime(
    input.resolveRuntime,
    manifest.document.rendererDomain
  );
  if (Either.isLeft(runtime)) {
    return yield* new PreviewIntegrityError({ check: "domain" });
  }
  return Option.some(
    yield* readReadyContent(manifest, config, runtime.right.components)
  );
});
