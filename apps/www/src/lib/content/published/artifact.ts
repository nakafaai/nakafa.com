import "@tanstack/react-start/server-only";

import type { SignedContentArtifact } from "@nakafa/aksara-contracts/content";
import { Effect } from "effect";
import { resolveRendererComponents } from "@/lib/content/renderer/components";
import { renderContentTree } from "@/lib/content/renderer/tree";

/** Renders an artifact already authenticated by its owning runtime boundary. */
export const renderVerifiedArtifact = Effect.fn(
  "NakafaContent.renderVerifiedArtifact"
)(function* (input: { readonly artifact: SignedContentArtifact }) {
  const { payload } = input.artifact;
  const components = yield* resolveRendererComponents(payload);
  const blocks = yield* renderContentTree(
    components,
    payload.contentKey,
    payload.rendererDomain,
    payload.contentTree,
    payload.artifactLocale
  );

  return {
    artifact: input.artifact,
    blocks,
  };
});
