import "server-only";

import type { RendererDomain } from "@nakafa/aksara-contracts/renderer/domain";
import { ContentVerificationKeyResolver } from "@nakafa/aksara-contracts/signature/spec";
import type { MDXComponents } from "@repo/design-system/types/markdown";
import { Effect } from "effect";
import type { PublishedMaterialContent } from "@/lib/content/material";
import { executeSignedArtifact } from "@/lib/content/published/artifact";
import { PublishedRendererMissingError } from "@/lib/content/published/errors";
import type { PublishedMaterialData } from "@/lib/content/published/exchange";
import { contentKeyResolver } from "@/lib/content/published/trust";

/** Inputs shared by one physical route after its trusted data lookup. */
interface RenderPublishedMaterialInput {
  readonly components: MDXComponents;
  readonly data: PublishedMaterialData;
  readonly rendererDomain: RendererDomain;
}

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
