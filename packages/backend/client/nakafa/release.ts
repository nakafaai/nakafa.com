import { readNakafaRuntimeQuery } from "@repo/backend/client/nakafa/query";
import { api } from "@repo/backend/convex/_generated/api";
import { NakafaAgentDataReadError } from "@repo/contents/_lib/agent/errors";
import { Effect } from "effect";

/** Verifies a multi-query agent read stayed on one active content release. */
export const verifyNakafaReleasePin = Effect.fn(
  "NakafaContent.verifyReleasePin"
)(function* (convexUrl: string, expectedActiveReleaseId: string | null) {
  const active = yield* readNakafaRuntimeQuery(
    convexUrl,
    api.contentRelease.runtime.active.read,
    {}
  );
  const activeReleaseId = active?.releaseId ?? null;
  if (activeReleaseId !== expectedActiveReleaseId) {
    return yield* new NakafaAgentDataReadError({
      cause: `Active content release changed from ${expectedActiveReleaseId ?? "none"} to ${activeReleaseId ?? "none"}.`,
      message: "Unable to complete one release-pinned Nakafa content read.",
    });
  }
  return activeReleaseId;
});
