import "@tanstack/react-start/server-only";

// Only Aksara artifacts that pass exact schema, hash, source, Ed25519 signature,
// and renderer compatibility verification reach the renderer below.
// https://github.com/nakafaai/aksara/blob/9b8cbbd9cc82704d9d7e36af04eb6bb439953fcd/packages/contracts/src/artifact/verify.ts#L9-L37
// https://github.com/nakafaai/aksara/blob/9b8cbbd9cc82704d9d7e36af04eb6bb439953fcd/packages/contracts/src/artifact/integrity.ts#L56-L92
import { verifySignedContentArtifact } from "@nakafa/aksara-contracts/artifact/verify";
import type { SignedContentArtifact } from "@nakafa/aksara-contracts/content";
import { RendererManifestEnvelopeSchema } from "@nakafa/aksara-contracts/renderer/contract";
import { Effect, Schema } from "effect";
import { resolveRendererComponents } from "@/lib/content/renderer/components";
import { renderContentTree } from "@/lib/content/renderer/tree";

/**
 * Inputs required to authenticate and render one trusted content artifact.
 * The artifact stays unknown until the verifier decodes it against its contract.
 */
const RenderArtifactInputSchema = Schema.Struct({
  artifact: Schema.Unknown,
  rendererManifest: RendererManifestEnvelopeSchema,
});
type RenderArtifactInput = typeof RenderArtifactInputSchema.Type;

/** Renders an artifact already authenticated by its owning runtime boundary. */
export const renderVerifiedArtifact = Effect.fn(
  "NakafaContent.renderVerifiedArtifact"
)(function* (input: { readonly artifact: SignedContentArtifact }) {
  const { payload } = input.artifact;
  const components = yield* resolveRendererComponents(payload);
  const element = yield* renderContentTree(
    components,
    payload.contentKey,
    payload.rendererDomain,
    payload.contentTree
  );

  return {
    artifact: input.artifact,
    element,
  };
});

/**
 * Authenticates one signed artifact, then renders its content tree. Nothing in
 * the artifact is evaluated, so a changed byte fails verification before rendering.
 */
export const renderSignedArtifact = Effect.fn(
  "NakafaContent.renderSignedArtifact"
)(function* (input: RenderArtifactInput) {
  const artifact = yield* verifySignedContentArtifact({
    artifact: input.artifact,
    rendererManifest: input.rendererManifest,
  });
  return yield* renderVerifiedArtifact({ artifact });
});
