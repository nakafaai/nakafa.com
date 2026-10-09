import "server-only";
import type { MaterialPreviewDocument } from "@nakafa/aksara-contracts/preview/document";
import type { PreviewReadySchema } from "@nakafa/aksara-contracts/preview/spec";
import { MaterialLessonProjectionSchema } from "@nakafa/aksara-contracts/projection/material";
import { Effect, Option, Schema } from "effect";
import { executePreviewArtifact } from "@/lib/content/preview/artifact";
import type { PreviewConfig } from "@/lib/content/preview/config";
import {
  PreviewCompileError,
  PreviewPendingError,
} from "@/lib/content/preview/errors";
import { readPreviewSnapshot } from "@/lib/content/preview/manifest";
import {
  type MaterialPreviewRouteInput,
  matchesMaterialPreviewRoute,
} from "@/lib/content/preview/route";
/** Exact material route identity requested by one Next server boundary. */
export type MaterialPreviewInput = MaterialPreviewRouteInput;
/** Authenticates and executes the exact ready material artifact. */
const readReadyContent = Effect.fn("NakafaContent.readReadyPreview")(function* (
  manifest: typeof PreviewReadySchema.Type,
  document: MaterialPreviewDocument,
  config: PreviewConfig
) {
  const previewArtifact = manifest.artifacts[0];
  const projection = yield* Schema.decodeUnknownEffect(
    MaterialLessonProjectionSchema
  )(previewArtifact.projection);
  const rendered = yield* executePreviewArtifact({
    config,
    document,
    manifest,
    previewArtifact,
  });
  return {
    Content: rendered.Content,
    appLocale: projection.appLocale,
    metadata: projection.metadata,
    projection,
    rawMdx: rendered.artifact.payload.rawMdx,
    rendererDomain: document.rendererDomain,
  };
});

/** Authenticated local body plus metadata rendered by the actual Nakafa app. */
export type MaterialPreviewContent = Effect.Success<
  ReturnType<typeof readReadyContent>
>;
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
  if (manifest.status === "pending") {
    return yield* PreviewPendingError.make({ revision: manifest.revision });
  }
  if (manifest.status === "failed") {
    return yield* PreviewCompileError.make({
      code: manifest.failure.code,
      message: manifest.failure.message,
      revision: manifest.revision,
    });
  }
  return Option.some(yield* readReadyContent(manifest, document, config));
});
