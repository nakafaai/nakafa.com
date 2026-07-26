import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { Effect } from "effect";

/** Immutable active release identity bound to a native pagination cursor. */
export interface ReleaseCursorIdentity {
  readonly manifestHash: string;
  readonly releaseId: string;
}

/** Checks whether one continuation cursor belongs to a superseded release. */
export function hasStaleReleaseCursor(
  cursor: null | string,
  expectedManifestHash: null | string,
  expectedReleaseId: null | string,
  active: null | ReleaseCursorIdentity
) {
  return (
    cursor !== null &&
    (!active ||
      expectedManifestHash !== active.manifestHash ||
      expectedReleaseId !== active.releaseId)
  );
}

/** Rejects continuation cursors whose active release identity changed. */
export const validateReleaseCursor = Effect.fn(
  "contentRelease.validateReleaseCursor"
)(function* (
  cursor: null | string,
  expectedManifestHash: null | string,
  expectedReleaseId: null | string,
  active: null | ReleaseCursorIdentity
) {
  if (cursor === null) {
    if (expectedManifestHash !== null || expectedReleaseId !== null) {
      return yield* releaseFail(
        "CONTENT_RELEASE_LIMIT",
        "An initial content page cannot claim a release cursor."
      );
    }
    return;
  }
  if (
    hasStaleReleaseCursor(
      cursor,
      expectedManifestHash,
      expectedReleaseId,
      active
    )
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_STALE_BASE",
      "The active content release changed during pagination."
    );
  }
});
