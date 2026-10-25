import { CompiledContentPayloadSchema } from "@nakafa/aksara-contracts/content";
import type { ContentReleaseManifest } from "@nakafa/aksara-contracts/release";
import type { ContentSnapshotSet } from "@nakafa/aksara-contracts/release/snapshot/spec";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import { releaseFail } from "@repo/backend/confect/contentRelease/error";
import { Effect, Option, Schema } from "effect";

/**
 * Content generations and the publication records signed under a retired one.
 *
 * A retired generation's records stay unreadable on purpose: the current
 * readers are strict, and the migration that would have re-signed them was
 * retired with its generation. A reader that can still meet one of those
 * records has to tell it apart from corruption, so it can ask for a republish
 * instead of reporting an integrity failure. This module owns the only
 * knowledge of what the retired markers look like, and of the bootstrap that
 * replaces the retired generation with no retained inverse.
 *
 * Each marker decodes its stored value with its own schema, so the check never
 * widens the current contract and never narrows unknown input by hand.
 */

/** Compiled-body format of the retired Aksara 0.51 contract. */
export const RETIRED_CONTENT_GENERATION = "mdx-function-body";

/** Compiled-body format of the current contract, read from the installed contract. */
export const CURRENT_CONTENT_GENERATION =
  CompiledContentPayloadSchema.fields.format.literal;

/** The content generation that an active release was published under. */
export const contentGenerationValidator = Schema.Literals([
  RETIRED_CONTENT_GENERATION,
  CURRENT_CONTENT_GENERATION,
]);

/** Retired artifact marker: the payload names the retired compiled-body format. */
const RetiredFormatArtifactSchema = Schema.Struct({
  payload: Schema.Struct({
    format: Schema.Literal(RETIRED_CONTENT_GENERATION),
  }),
});

/** Older retired artifact marker: component requirements carry explicit versions. */
const VersionedComponentArtifactSchema = Schema.Struct({
  payload: Schema.Struct({
    requiredComponents: Schema.Array(
      Schema.Struct({
        version: Schema.Finite,
      })
    ).pipe(Schema.check(Schema.isMinLength(1))),
  }),
});

/** Retired release marker: the manifest declares a renderer contract version. */
const RetiredReleaseSchema = Schema.fromJsonString(
  Schema.Struct({
    manifest: Schema.Struct({
      rendererContractVersion: Schema.String,
    }),
  })
);

/** Fails one parsed rollback artifact signed under a retired content contract. */
export const requireCurrentArtifact = Effect.fn(
  "contentRelease.requireCurrentArtifact"
)(function* (artifact: unknown, identity: string, artifactHash: string) {
  const retired =
    Option.isSome(
      Schema.decodeUnknownOption(RetiredFormatArtifactSchema)(artifact)
    ) ||
    Option.isSome(
      Schema.decodeUnknownOption(VersionedComponentArtifactSchema)(artifact)
    );
  if (!retired) {
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

/**
 * Whether the try-out snapshot is replaced or holds no snapshot. Its placements
 * bind question artifacts, so keeping the base snapshot would keep the retired
 * generation's try-out bodies active. Program and Quran snapshots hold structured
 * rows that bind no artifact and whose contract the generation change left
 * unchanged, so a bootstrap may inherit them, as the publisher does when their
 * data did not change.
 */
function replacesTryoutSnapshot(snapshots: ContentSnapshotSet) {
  return (
    snapshots.tryout.mode === "replace" ||
    snapshots.tryout.resultSnapshotId === null
  );
}

/**
 * Whether a verified candidate may replace the retired generation as a
 * bootstrap. The backend decides from its own stored state and the signed
 * counts, never from what the publisher declares: the candidate must extend the
 * active release, that release must still be in the retired generation, the
 * result must hold only upserted heads, the try-out snapshot must be replaced
 * or empty, and no recovery may be staged.
 */
export function isBootstrapCandidate(
  manifest: ContentReleaseManifest,
  state: Pick<
    Docs["contentState"],
    "activeContentGeneration" | "activeReleaseId" | "recoveryReleaseId"
  >
) {
  return (
    manifest.baseReleaseId !== null &&
    manifest.baseReleaseId === state.activeReleaseId &&
    state.activeContentGeneration === RETIRED_CONTENT_GENERATION &&
    manifest.resultCount === manifest.upsertCount &&
    replacesTryoutSnapshot(manifest.snapshots) &&
    state.recoveryReleaseId === undefined
  );
}

/**
 * Refuses a release that builds on an active release whose content generation
 * is not the current one. The active release is the base of a candidate and
 * the catalog that a recovery restores. A generation that was never recorded is
 * refused as well, until the migration records it. The current generation and
 * the genesis case, with no active release at all, are the only passing states.
 */
export const requireCurrentBase = Effect.fn(
  "contentRelease.requireCurrentBase"
)(function* (
  releaseId: string,
  state: Pick<
    Docs["contentState"],
    "activeContentGeneration" | "activeReleaseId"
  >
) {
  if (
    state.activeReleaseId === undefined ||
    state.activeContentGeneration === CURRENT_CONTENT_GENERATION
  ) {
    return;
  }
  if (state.activeContentGeneration === undefined) {
    return yield* releaseFail(
      "CONTENT_RELEASE_STATE",
      `Content release ${releaseId} builds on an active release whose content generation is not recorded. Run the generation migration before publishing over it.`
    );
  }
  return yield* releaseFail(
    "CONTENT_RELEASE_STATE",
    `Content release ${releaseId} extends a retired content generation. Only a bootstrap that replaces every head may publish over it.`
  );
});

/** Refuses an inverse-based operation on a bootstrap, which has no retained inverse. */
export const requireRollbackable = Effect.fn(
  "contentRelease.requireRollbackable"
)(function* (
  release: Pick<Docs["contentReleases"], "bootstrap" | "releaseId">
) {
  if (release.bootstrap !== true) {
    return;
  }
  return yield* releaseFail(
    "CONTENT_RELEASE_UNSUPPORTED",
    `Content release ${release.releaseId} replaced the retired content generation without a retained inverse. Publish a new release instead of rolling back across the contract change.`
  );
});
