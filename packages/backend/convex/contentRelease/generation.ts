import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { Effect } from "effect";

/**
 * Publication records signed under a retired content contract.
 *
 * A retired generation's records stay unreadable on purpose: the current
 * readers are strict, and the migration that would have re-signed them was
 * retired with its generation. A reader that can still meet one of those
 * records has to tell it apart from corruption, so it can ask for a republish
 * instead of reporting an integrity failure. This module owns the only
 * knowledge of what the retired markers look like.
 */

/** Narrows one unknown stored value to a plain record. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Reads one stored JSON value, reporting invalid bytes as unrecognized. */
function readStoredRecord(source: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(source);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** Detects one stored artifact that requires components by version. */
function hasVersionedComponentRequirements(source: string) {
  const payload = readStoredRecord(source)?.payload;
  if (!(isRecord(payload) && Array.isArray(payload.requiredComponents))) {
    return false;
  }
  return payload.requiredComponents.some(
    (entry) => isRecord(entry) && typeof entry.version === "number"
  );
}

/** Detects one stored release that declares a renderer contract version. */
function hasRendererContractVersion(source: string) {
  const manifest = readStoredRecord(source)?.manifest;
  if (!isRecord(manifest)) {
    return false;
  }
  return typeof manifest.rendererContractVersion === "string";
}

/** Fails one rollback artifact signed under a retired content contract. */
export const requireCurrentArtifact = Effect.fn(
  "contentRelease.requireCurrentArtifact"
)(function* (source: string, identity: string, artifactHash: string) {
  if (!hasVersionedComponentRequirements(source)) {
    return;
  }
  return yield* releaseFail(
    "CONTENT_RELEASE_UNSUPPORTED",
    `Rollback state ${identity} cannot read artifact ${artifactHash}, which was signed under a retired content contract. Publish a new release instead of rolling back across the contract change.`
  );
});

/** Fails one stored release signed under a retired content contract. */
export const requireCurrentRelease = Effect.fn(
  "contentRelease.requireCurrentRelease"
)(function* (source: string, releaseId: string) {
  if (!hasRendererContractVersion(source)) {
    return;
  }
  return yield* releaseFail(
    "CONTENT_RELEASE_UNSUPPORTED",
    `Content release ${releaseId} was signed under a retired content contract, so this deployment cannot read it. Republish the content to inspect that release again.`
  );
});
