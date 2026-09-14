import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { Effect, Option, Schema } from "effect";

/**
 * Publication records signed under a retired content contract.
 *
 * A retired generation's records stay unreadable on purpose: the current
 * readers are strict, and the migration that would have re-signed them was
 * retired with its generation. A reader that can still meet one of those
 * records has to tell it apart from corruption, so it can ask for a republish
 * instead of reporting an integrity failure. This module owns the only
 * knowledge of what the retired markers look like.
 *
 * Each marker decodes the stored bytes with its own schema, so the check never
 * widens the current contract and never narrows unknown input by hand.
 */

/** Retired artifact marker: component requirements carry explicit versions. */
const RetiredArtifactSchema = Schema.fromJsonString(
  Schema.Struct({
    payload: Schema.Struct({
      requiredComponents: Schema.Array(
        Schema.Struct({ version: Schema.Finite })
      ).pipe(Schema.check(Schema.isMinLength(1))),
    }),
  })
);

/** Retired release marker: the manifest declares a renderer contract version. */
const RetiredReleaseSchema = Schema.fromJsonString(
  Schema.Struct({
    manifest: Schema.Struct({ rendererContractVersion: Schema.String }),
  })
);

/** Fails one rollback artifact signed under a retired content contract. */
export const requireCurrentArtifact = Effect.fn(
  "contentRelease.requireCurrentArtifact"
)(function* (source: string, identity: string, artifactHash: string) {
  const retired = Schema.decodeOption(RetiredArtifactSchema)(source);
  if (Option.isNone(retired)) {
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
  const retired = Schema.decodeOption(RetiredReleaseSchema)(source);
  if (Option.isNone(retired)) {
    return;
  }
  return yield* releaseFail(
    "CONTENT_RELEASE_UNSUPPORTED",
    `Content release ${releaseId} was signed under a retired content contract, so this deployment cannot read it. Republish the content to inspect that release again.`
  );
});
