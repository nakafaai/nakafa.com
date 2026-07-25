import {
  canonicalizeSignedContentArtifact,
  type SignedContentArtifactSchema,
} from "@nakafa/aksara-contracts/content";
import {
  type ContentProjectionSchema,
  canonicalizeContentProjection,
} from "@nakafa/aksara-contracts/projection/spec";
import {
  type ContentReleaseItemSchema,
  canonicalizeContentReleaseItem,
  type SignedContentReleaseSchema,
} from "@nakafa/aksara-contracts/release";
import {
  type ContentRouteItemSchema,
  canonicalizeContentRouteItem,
} from "@nakafa/aksara-contracts/release/route";
import {
  type ContentSnapshotManifestSchema,
  type ContentSnapshotRowSchema,
  canonicalizeContentSnapshotRow,
} from "@nakafa/aksara-contracts/release/snapshot-data";
import type { RendererManifestEnvelopeSchema } from "@nakafa/aksara-contracts/renderer/contract";

/** Stores one signed release without introducing a second wire canonicalizer. */
export function encodeReleaseJson(
  release: typeof SignedContentReleaseSchema.Type
) {
  return JSON.stringify(release);
}

/** Stores one item using the canonicalizer owned by Aksara contracts. */
export function encodeItemJson(item: typeof ContentReleaseItemSchema.Type) {
  return canonicalizeContentReleaseItem(item);
}

/** Stores one route item using the canonicalizer owned by Aksara contracts. */
export function encodeRouteJson(item: typeof ContentRouteItemSchema.Type) {
  return canonicalizeContentRouteItem(item);
}

/** Stores one artifact using the canonicalizer owned by Aksara contracts. */
export function encodeArtifactJson(
  artifact: typeof SignedContentArtifactSchema.Type
) {
  return canonicalizeSignedContentArtifact(artifact);
}

/** Stores one projection using the canonicalizer owned by Aksara contracts. */
export function encodeProjectionJson(
  projection: typeof ContentProjectionSchema.Type
) {
  return canonicalizeContentProjection(projection);
}

/** Stores one schema-decoded family manifest without a duplicate wire format. */
export function encodeSnapshotJson(
  snapshot: typeof ContentSnapshotManifestSchema.Type
) {
  return JSON.stringify(snapshot);
}

/** Stores one structured row through the contract-owned canonicalizer. */
export function encodeSnapshotRowJson(
  row: typeof ContentSnapshotRowSchema.Type
) {
  return canonicalizeContentSnapshotRow(row);
}

/** Stores one already-canonical renderer envelope without a mirror schema. */
export function encodeRendererJson(
  renderer: typeof RendererManifestEnvelopeSchema.Type
) {
  return JSON.stringify(renderer);
}
