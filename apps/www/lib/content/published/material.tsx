import "server-only";

import type {
  CorpusSourcePath,
  GitCommitSha,
} from "@nakafa/aksara-contracts/ids";
import type {
  MaterialLessonProjection,
  MaterialMetadata,
} from "@nakafa/aksara-contracts/projection/material";
import { ContentVerificationKeyResolver } from "@nakafa/aksara-contracts/signature/spec";
import { contentKeyResolver } from "@repo/backend/content/trust";
import { Effect } from "effect";
import type { ReactNode } from "react";
import { applyPublishedContentCache } from "@/lib/content/cache";
import { decodeMaterialProjection } from "@/lib/content/material/decode";
import { executeSignedArtifact } from "@/lib/content/published/artifact";
import {
  type PublishedContentData,
  type PublishedContentInput,
  readPublishedContent,
} from "@/lib/content/published/exchange";
import { getRendererComponents } from "@/lib/content/renderer/components";

/** Exact public material identity sent to the shared runtime seam. */
export type PublishedMaterialInput = PublishedContentInput;

/** Verified material body and source evidence consumed by the page shell. */
export interface PublishedMaterialContent {
  readonly body: ReactNode;
  readonly metadata: MaterialMetadata;
  readonly projection: MaterialLessonProjection;
  readonly rawMdx: string;
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
  const data = yield* readPublishedContent(input);
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

/** Authenticates and renders one artifact through its physical registry. */
const renderMaterialArtifact = Effect.fn(
  "NakafaContent.renderMaterialArtifact"
)(function* (data: PublishedMaterialData) {
  const components = getRendererComponents(
    data.artifact.payload.rendererDomain
  );
  const rendered = yield* executeSignedArtifact({
    artifact: data.artifact,
    components,
    rendererContractVersion: data.rendererManifest.rendererContractVersion,
    rendererManifest: data.rendererManifest,
  }).pipe(
    Effect.provideService(ContentVerificationKeyResolver, contentKeyResolver)
  );

  return {
    body: <rendered.Content />,
    metadata: data.metadata,
    projection: data.projection,
    rawMdx: rendered.artifact.payload.rawMdx,
    sourcePath: data.sourcePath,
    sourceRevision: data.sourceRevision,
  } satisfies PublishedMaterialContent;
});

/** Caches verified material metadata and provenance under exact signed tags. */
export async function getPublishedMaterial(input: PublishedMaterialInput) {
  "use cache";

  const data = await Effect.runPromise(readPublishedMaterial(input));
  applyPublishedContentCache("material", data.artifact.artifactHash);
  return data;
}

/** Caches JSX rendered from one reviewed, signed Aksara material artifact. */
export async function renderPublishedMaterial(input: PublishedMaterialInput) {
  "use cache";

  const data = await getPublishedMaterial(input);
  return Effect.runPromise(renderMaterialArtifact(data));
}
