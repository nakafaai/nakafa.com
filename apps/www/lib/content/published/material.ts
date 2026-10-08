import "server-only";

import {
  MaterialLessonProjectionSchema,
  MaterialMetadataSchema,
} from "@nakafa/aksara-contracts/projection/material";
import { Effect, Schema } from "effect";
import type { ReactNode } from "react";
import { decodeMaterialProjection } from "@/lib/content/material/decode";
import { readRenderedBody } from "@/lib/content/published/body";
import {
  type PublishedContentData,
  type PublishedContentRouteInput,
  readCurrentPublishedContent,
} from "@/lib/content/published/exchange";

/** Exact public material identity sent to the shared runtime seam. */
export type PublishedMaterialInput = PublishedContentRouteInput;

const PublishedMaterialFieldsSchema = Schema.Struct({
  metadata: MaterialMetadataSchema,
  projection: MaterialLessonProjectionSchema,
});
/** Verified material projection adapted to the current Nakafa route shell. */
export type PublishedMaterialData = Omit<PublishedContentData, "projection"> &
  typeof PublishedMaterialFieldsSchema.Type;

/** Verified material body and source evidence consumed by the page shell. */
export type PublishedMaterialContent = Readonly<
  Effect.Success<ReturnType<typeof renderMaterialArtifact>>
>;

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

/** Reads and strictly narrows one verified runtime exchange to material data. */
export const readPublishedMaterial = Effect.fn(
  "NakafaContent.readPublishedMaterial"
)(function* (input: PublishedMaterialInput) {
  return yield* decodeMaterialData(
    yield* readCurrentPublishedContent(input),
    input
  );
});

/** Renders one artifact already authenticated by the runtime exchange. */
export const renderMaterialArtifact = Effect.fn(
  "NakafaContent.renderMaterialArtifact"
)(function* (data: PublishedMaterialData) {
  const body: ReactNode = yield* readRenderedBody(data.artifact);

  return {
    activeReleaseId: data.activeReleaseId,
    artifactHash: data.artifact.artifactHash,
    body,
    metadata: data.metadata,
    projection: data.projection,
    rawMdx: data.artifact.payload.rawMdx,
    rendererDomain: data.artifact.payload.rendererDomain,
    sourcePath: data.sourcePath,
    sourceRevision: data.sourceRevision,
  };
});

/** Reads and renders one material through one signed publication program. */
export const readRenderedMaterial = Effect.fn(
  "NakafaContent.readRenderedMaterial"
)(function* (input: PublishedMaterialInput) {
  const data = yield* readPublishedMaterial(input);
  return yield* renderMaterialArtifact(data);
});
