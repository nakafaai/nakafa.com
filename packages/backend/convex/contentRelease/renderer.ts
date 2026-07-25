import type { ContentReleaseManifest } from "@nakafa/aksara-contracts/release";
import type { RendererManifestEnvelope } from "@nakafa/aksara-contracts/renderer/contract";

/** Checks the complete renderer identity signed by one release manifest. */
export function hasRendererIdentity(
  manifest: ContentReleaseManifest,
  renderer: RendererManifestEnvelope
) {
  const signedIdentity = `${manifest.rendererContractVersion}:${manifest.rendererManifestHash}`;
  const rendererIdentity = `${renderer.rendererContractVersion}:${renderer.hash}`;
  return signedIdentity === rendererIdentity;
}
