import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { Effect } from "effect";

interface ActiveReleaseIdentity {
  readonly releaseId: string;
}

/** Requires a multi-read operation to remain on one active release. */
export const requireExpectedActiveRelease = Effect.fn(
  "contentRelease.requireExpectedActiveRelease"
)(function* (
  active: ActiveReleaseIdentity | null,
  expectedActiveReleaseId: string | null | undefined,
  operation: string
) {
  const activeReleaseId = active?.releaseId ?? null;
  if (
    expectedActiveReleaseId !== undefined &&
    activeReleaseId !== expectedActiveReleaseId
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_STATE",
      `${operation} expected active release ${expectedActiveReleaseId ?? "none"} but found ${activeReleaseId ?? "none"}.`
    );
  }
  return activeReleaseId;
});
