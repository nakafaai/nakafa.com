import "server-only";

import type {
  CorpusSourcePath,
  GitCommitSha,
} from "@nakafa/aksara-contracts/ids";
import type {
  MaterialLessonProjection,
  MaterialMetadata,
} from "@nakafa/aksara-contracts/projection/material";
import type { RendererDomain } from "@nakafa/aksara-contracts/renderer/domain";
import { Effect } from "effect";
import type { ReactNode } from "react";
import { decodeMaterialProjection } from "@/lib/content/material/decode";
import { evaluateVerifiedArtifact } from "@/lib/content/published/artifact";
import {
  type PublishedContentData,
  type PublishedContentRouteInput,
  readCurrentPublishedContent,
} from "@/lib/content/published/exchange";

/** Exact public material identity sent to the shared runtime seam. */
export type PublishedMaterialInput = PublishedContentRouteInput;

/** Verified material body and source evidence consumed by the page shell. */
export interface PublishedMaterialContent {
  readonly activeReleaseId: PublishedMaterialData["activeReleaseId"];
  readonly artifactHash: PublishedMaterialData["artifact"]["artifactHash"];
  readonly body: ReactNode;
  readonly metadata: MaterialMetadata;
  readonly projection: MaterialLessonProjection;
  readonly rawMdx: string;
  readonly rendererDomain: RendererDomain;
  readonly sourcePath: CorpusSourcePath;
  readonly sourceRevision: GitCommitSha | null;
}

/** Verified material projection adapted to the current Nakafa route shell. */
export interface PublishedMaterialData
  extends Omit<PublishedContentData, "projection"> {
  readonly metadata: MaterialMetadata;
  readonly projection: MaterialLessonProjection;
}

/** Reads and strictly narrows one verified runtime exchange to material data. */
export const readPublishedMaterial = Effect.fn(
  "NakafaContent.readPublishedMaterial"
)(function* (input: PublishedMaterialInput) {
  const data = yield* readCurrentPublishedContent(input);
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
});

/** Renders one artifact already authenticated by the runtime exchange. */
const renderMaterialArtifact = Effect.fn(
  "NakafaContent.renderMaterialArtifact"
)(function* (data: PublishedMaterialData) {
  const rendered = yield* evaluateVerifiedArtifact({ artifact: data.artifact });

  return {
    activeReleaseId: data.activeReleaseId,
    artifactHash: data.artifact.artifactHash,
    body: <rendered.Content />,
    metadata: data.metadata,
    projection: data.projection,
    rawMdx: rendered.artifact.payload.rawMdx,
    rendererDomain: rendered.artifact.payload.rendererDomain,
    sourcePath: data.sourcePath,
    sourceRevision: data.sourceRevision,
  } satisfies PublishedMaterialContent;
});

/** Reads and renders one material through one signed publication program. */
export const readRenderedMaterial = Effect.fn(
  "NakafaContent.readRenderedMaterial"
)(function* (input: PublishedMaterialInput) {
  const data = yield* readPublishedMaterial(input);
  return yield* renderMaterialArtifact(data);
});
