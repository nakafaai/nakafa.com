import { contentOutline } from "@repo/contents/toc";
import "@tanstack/react-start/server-only";

import {
  MaterialLessonProjectionSchema,
  MaterialMetadataSchema,
} from "@nakafa/aksara-contracts/projection/material";
import { Effect, Option, Schema } from "effect";
import { decodeMaterialProjection } from "@/lib/content/material/decode";
import { readRenderedBody } from "@/lib/content/published/body";
import type {
  PublishedContentData,
  PublishedContentRouteInput,
} from "@/lib/content/published/exchange";

/** Exact public material identity sent to the shared runtime seam. */
type PublishedMaterialInput = PublishedContentRouteInput;

const PublishedMaterialFieldsSchema = Schema.Struct({
  metadata: MaterialMetadataSchema,
  projection: MaterialLessonProjectionSchema,
});
/** Verified material projection adapted to the current Nakafa route shell. */
type PublishedMaterialData = Omit<PublishedContentData, "projection"> &
  typeof PublishedMaterialFieldsSchema.Type;

/** Strictly narrows one verified runtime exchange to material data. */
export const decodeMaterialData = Effect.fn("NakafaContent.decodeMaterialData")(
  function* (data: PublishedContentData, input: PublishedMaterialInput) {
    const projection = yield* decodeMaterialProjection(data.projection, input);

    return {
      activeReleaseId: data.activeReleaseId,
      artifact: data.artifact,
      metadata: projection.metadata,
      projection,
      rendererManifest: data.rendererManifest,
      sourcePath: data.sourcePath,
      sourceRevision: data.sourceRevision,
    } satisfies PublishedMaterialData;
  }
);

/** Renders one artifact already authenticated by the runtime exchange. */
export const renderMaterialArtifact = Effect.fn(
  "NakafaContent.renderMaterialArtifact"
)(function* (data: PublishedMaterialData) {
  const body = yield* readRenderedBody(data.artifact, Option.some("material"));

  return {
    activeReleaseId: data.activeReleaseId,
    artifactHash: data.artifact.artifactHash,
    body,
    headings: contentOutline(data.artifact.payload.contentTree),
    metadata: data.metadata,
    projection: data.projection,
    rawMdx: data.artifact.payload.rawMdx,
    rendererDomain: data.artifact.payload.rendererDomain,
    sourcePath: data.sourcePath,
    sourceRevision: data.sourceRevision,
  };
});
