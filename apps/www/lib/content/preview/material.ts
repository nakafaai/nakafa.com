import "server-only";

import type { MaterialPreviewDocument } from "@nakafa/aksara-contracts/preview/document";
import type { LocalPreviewManifest } from "@nakafa/aksara-contracts/preview/spec";
import {
  MaterialLessonProjectionSchema,
  type MaterialMetadata,
} from "@nakafa/aksara-contracts/projection/material";
import type { PublicContentRoute } from "@repo/contents/_types/route/schema";
import { Effect, Option, Schema } from "effect";
import { executePreviewArtifact } from "@/lib/content/preview/artifact";
import type { PreviewConfig } from "@/lib/content/preview/config";
import {
  PreviewCompileError,
  PreviewPendingError,
} from "@/lib/content/preview/errors";
import { readPreviewSnapshot } from "@/lib/content/preview/manifest";
import {
  decodeMaterialPreviewRoute,
  type MaterialPreviewRouteInput,
  matchesMaterialPreviewRoute,
} from "@/lib/content/preview/route";
import type { RenderableContent } from "@/lib/content/published/artifact";

/** Exact material route identity requested by one Next server boundary. */
export type MaterialPreviewInput = MaterialPreviewRouteInput;

/** Authenticated local body plus metadata rendered by the actual Nakafa app. */
export interface MaterialPreviewContent {
  readonly Content: RenderableContent["Content"];
  readonly locale: MaterialPreviewDocument["route"]["locale"];
  readonly metadata: MaterialMetadata;
  readonly rawMdx: string;
  readonly route: PublicContentRoute;
}

/** Authenticates and executes the exact ready material artifact. */
const readReadyContent = Effect.fn("NakafaContent.readReadyPreview")(function* (
  manifest: Extract<LocalPreviewManifest, { readonly status: "ready" }>,
  document: MaterialPreviewDocument,
  config: PreviewConfig
) {
  const previewArtifact = manifest.artifacts[0];
  const projection = yield* Schema.decodeUnknown(
    MaterialLessonProjectionSchema
  )(previewArtifact.projection);

  const route = yield* decodeMaterialPreviewRoute(projection);
  const rendered = yield* executePreviewArtifact({
    config,
    document,
    manifest,
    projection,
  });
  return {
    Content: rendered.Content,
    locale: projection.locale,
    metadata: projection.metadata,
    rawMdx: rendered.artifact.payload.rawMdx,
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
