import "server-only";

import type { MaterialMetadata } from "@nakafa/aksara-contracts/projection/material";
import type { RendererDomain } from "@nakafa/aksara-contracts/renderer/domain";
import { ContentVerificationKeyResolver } from "@nakafa/aksara-contracts/signature/spec";
import { contentKeyResolver } from "@repo/backend/content/trust";
import type { PublicContentRouteSchema } from "@repo/contents/_types/route/schema";
import type { MDXComponents } from "@repo/design-system/types/markdown";
import { Effect } from "effect";
import type { PublishedMaterialContent } from "@/lib/content/material";
import { executeSignedArtifact } from "@/lib/content/published/artifact";
import { PublishedRendererMissingError } from "@/lib/content/published/errors";
import {
  type PublishedContentData,
  type PublishedContentInput,
  readPublishedContent,
} from "@/lib/content/published/exchange";
import { decodePublishedMaterial } from "@/lib/content/published/projection";

/** Exact public material identity sent to the shared runtime seam. */
export type PublishedMaterialInput = PublishedContentInput;

/** Verified material projection adapted to the current Nakafa route shell. */
export interface PublishedMaterialData
  extends Omit<PublishedContentData, "projection"> {
  readonly metadata: MaterialMetadata;
  readonly route: typeof PublicContentRouteSchema.Type;
}

/** Inputs shared by one physical route after its trusted data lookup. */
interface RenderPublishedMaterialInput {
  readonly components: MDXComponents;
  readonly data: PublishedMaterialData;
  readonly rendererDomain: RendererDomain;
}

/** Reads and strictly narrows one verified runtime exchange to material data. */
export const readPublishedMaterial = Effect.fn(
  "NakafaContent.readPublishedMaterial"
)(function* (input: PublishedMaterialInput) {
  const data = yield* readPublishedContent(input);
  const { projection, route } = yield* decodePublishedMaterial(
    data.projection,
    input
  );

  return {
    activeReleaseId: data.activeReleaseId,
    artifact: data.artifact,
    metadata: projection.metadata,
    rendererManifest: data.rendererManifest,
    route,
    sourcePath: data.sourcePath,
    sourceRevision: data.sourceRevision,
  } satisfies PublishedMaterialData;
});

/** Authenticates and renders one artifact through its exact physical registry. */
export const renderPublishedMaterial = Effect.fn(
  "NakafaContent.renderPublishedMaterial"
)(function* (input: RenderPublishedMaterialInput) {
  if (input.data.artifact.payload.rendererDomain !== input.rendererDomain) {
    return yield* new PublishedRendererMissingError({
      rendererDomain: input.data.artifact.payload.rendererDomain,
    });
  }
  const rendered = yield* executeSignedArtifact({
    artifact: input.data.artifact,
    components: input.components,
    rendererContractVersion:
      input.data.rendererManifest.rendererContractVersion,
    rendererManifest: input.data.rendererManifest,
  }).pipe(
    Effect.provideService(ContentVerificationKeyResolver, contentKeyResolver)
  );

  return {
    body: <rendered.Content />,
    metadata: input.data.metadata,
    rawMdx: rendered.artifact.payload.rawMdx,
    route: input.data.route,
    sourcePath: input.data.sourcePath,
    sourceRevision: input.data.sourceRevision,
  } satisfies PublishedMaterialContent;
});
