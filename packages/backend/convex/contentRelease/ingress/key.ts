import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { Effect } from "effect";

/** Rejects new publication bytes signed by a retained but inactive key. */
export const requireActiveContentKey = Effect.fn(
  "contentRelease.requireActiveKey"
)(function* (keyId: string, activeKeyId: string, subject: string) {
  if (keyId !== activeKeyId) {
    return yield* releaseFail(
      "CONTENT_RELEASE_UNSUPPORTED",
      `${subject} must use the active content signing key.`
    );
  }
});
