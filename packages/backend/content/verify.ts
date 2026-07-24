import { verifySignedContentArtifact } from "@nakafa/aksara-contracts/artifact/verify";
import { hashContentProjection } from "@nakafa/aksara-contracts/projection/hash";
import type { ContentProjection } from "@nakafa/aksara-contracts/projection/spec";
import { verifyContentReleaseBundle } from "@nakafa/aksara-contracts/release/verify";
import { validateRendererManifestHash } from "@nakafa/aksara-contracts/renderer/manifest";
import {
  type ContentRuntimeFound,
  decodeContentRuntimeRequest,
  decodeContentRuntimeResponse,
} from "@nakafa/aksara-contracts/runtime/spec";
import { Effect, Schema } from "effect";

/** A runtime response or live renderer does not match its trusted identity. */
export class ContentEnvelopeMismatchError extends Schema.TaggedError<ContentEnvelopeMismatchError>()(
  "ContentEnvelopeMismatchError",
  {
    reason: Schema.Literal(
      "activeManifestHash",
      "activeReleaseId",
      "delivery",
      "locale",
      "projectionHash",
      "publicPath",
      "rendererManifest",
      "sourcePath"
    ),
  }
) {}

/** Checks one article path preserves its pair-grouped corpus identity. */
function hasArticleSourcePath(
  projection: Extract<ContentProjection, { readonly kind: "article" }>,
  sourcePath: string
) {
  const prefix = `packages/corpus/articles/${projection.category}/`;
  const suffix = `/${projection.locale}.mdx`;
  if (!(sourcePath.startsWith(prefix) && sourcePath.endsWith(suffix))) {
    return false;
  }

  const sourceRoot = sourcePath.slice(prefix.length, -suffix.length);
  const segments = sourceRoot.split("/");

  return segments.length === 2 && segments.join("-") === projection.articleSlug;
}

/** Checks one source path exactly matches its projected content family. */
function hasProjectionSourcePath(
  projection: ContentProjection,
  sourcePath: string
) {
  if (projection.kind === "article") {
    return hasArticleSourcePath(projection, sourcePath);
  }

  return (
    sourcePath ===
    `packages/corpus/${projection.contentKey}/${projection.locale}.mdx`
  );
}

/**
 * Verifies one signed runtime envelope without requiring a React registry.
 *
 * Raw Markdown consumers use the release-owned renderer snapshot. Executable
 * consumers must additionally call `verifyContentRenderer` with their live
 * physical registry before evaluating compiled code.
 */
export const verifyContentEnvelope = Effect.fn(
  "NakafaContent.verifyContentEnvelope"
)(function* ({
  request: requestInput,
  response: responseInput,
}: {
  readonly request: unknown;
  readonly response: unknown;
}) {
  const request = yield* decodeContentRuntimeRequest(requestInput);
  const response = yield* decodeContentRuntimeResponse(responseInput);

  if (response.kind !== "found") {
    return response;
  }
  if (response.delivery !== request.delivery) {
    return yield* new ContentEnvelopeMismatchError({ reason: "delivery" });
  }
  if (response.projection.locale !== request.locale) {
    return yield* new ContentEnvelopeMismatchError({ reason: "locale" });
  }
  if (response.projection.publicPath !== request.publicPath) {
    return yield* new ContentEnvelopeMismatchError({ reason: "publicPath" });
  }
  if (!hasProjectionSourcePath(response.projection, response.sourcePath)) {
    return yield* new ContentEnvelopeMismatchError({ reason: "sourcePath" });
  }

  const bundle = yield* verifyContentReleaseBundle({
    release: response.release,
    rendererManifest: response.rendererManifest,
  });
  if (response.activeReleaseId !== bundle.release.manifest.releaseId) {
    return yield* new ContentEnvelopeMismatchError({
      reason: "activeReleaseId",
    });
  }
  if (response.activeManifestHash !== bundle.release.manifestHash) {
    return yield* new ContentEnvelopeMismatchError({
      reason: "activeManifestHash",
    });
  }
  if (response.projectionHash !== hashContentProjection(response.projection)) {
    return yield* new ContentEnvelopeMismatchError({
      reason: "projectionHash",
    });
  }

  yield* verifySignedContentArtifact({
    artifact: response.artifact,
    rendererContractVersion: bundle.release.manifest.rendererContractVersion,
    rendererManifest: bundle.rendererManifest,
  });

  return response;
});

/** Requires one executable consumer's live registry to match signed content. */
export const verifyContentRenderer = Effect.fn(
  "NakafaContent.verifyContentRenderer"
)(function* ({
  found,
  rendererManifest,
}: {
  readonly found: ContentRuntimeFound;
  readonly rendererManifest: unknown;
}) {
  const liveRenderer = yield* validateRendererManifestHash(rendererManifest);
  if (liveRenderer.hash !== found.rendererManifest.hash) {
    return yield* new ContentEnvelopeMismatchError({
      reason: "rendererManifest",
    });
  }

  return found;
});
