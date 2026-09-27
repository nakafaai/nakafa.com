import { releaseFail } from "@repo/backend/confect/contentRelease/error";
import { loadRelease } from "@repo/backend/confect/contentRelease/model";
import { decodeReleaseJson } from "@repo/backend/confect/contentRelease/parse";
import { Effect } from "effect";
/** Reads stored authenticated envelopes only for one exact manifest identity. */
export const envelopeProgram = Effect.fn("contentRelease.envelope")(function* (
  releaseId: string,
  manifestHash: string
) {
  const release = yield* loadRelease(releaseId);
  const signed = yield* decodeReleaseJson(release.releaseJson);
  if (signed.manifestHash !== manifestHash) {
    return yield* releaseFail(
      "CONTENT_RELEASE_CONFLICT",
      `Content release ${releaseId} does not own manifest ${manifestHash}.`
    );
  }
  return {
    releaseJson: release.releaseJson,
    rendererJson: release.rendererJson,
  };
});
