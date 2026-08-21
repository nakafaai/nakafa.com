"use node";

import { verifySignedContentArtifact } from "@nakafa/aksara-contracts/artifact/verify";
import type {
  RendererContractVersion,
  RendererManifestEnvelope,
} from "@nakafa/aksara-contracts/renderer/contract";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import {
  decodeArtifactJson,
  decodeItemJson,
} from "@repo/backend/convex/contentRelease/parse";
import { contractFailure } from "@repo/backend/convex/contentRelease/proof/failure";
import type { ArtifactProofPage } from "@repo/backend/convex/contentRelease/proof/read";
import { Effect, Stream } from "effect";

/** Reauthenticates one publisher-owned artifact batch against its item. */
export const verifyArtifactBatch = Effect.fn(
  "contentRelease.verifyArtifactBatch"
)(function* (
  rows: ArtifactProofPage["rows"],
  releaseId: string,
  renderer: RendererManifestEnvelope,
  rendererContractVersion: RendererContractVersion
) {
  return yield* Stream.fromIterable(rows).pipe(
    Stream.runFoldEffect(
      () => 0,
      (count, row) =>
        Effect.gen(function* () {
          const item = yield* decodeItemJson(row.itemJson);
          if (item.change.operation === "delete") {
            return yield* releaseFail(
              "CONTENT_RELEASE_INTEGRITY",
              `Delete item ${releaseId}/${row.index} entered an artifact batch.`
            );
          }
          const artifact = yield* decodeArtifactJson(row.artifactJson);
          const verified = yield* verifySignedContentArtifact({
            artifact,
            rendererContractVersion,
            rendererManifest: renderer,
          }).pipe(Effect.mapError(contractFailure));
          if (
            verified.artifactHash !== item.change.artifactHash ||
            verified.payload.contentKey !== item.change.contentKey ||
            verified.payload.artifactLocale !== item.change.artifactLocale ||
            verified.payload.rendererDomain !== item.change.rendererDomain
          ) {
            return yield* releaseFail(
              "CONTENT_RELEASE_INTEGRITY",
              `Artifact for ${releaseId}/${row.index} does not match its item.`
            );
          }
          return count + 1;
        })
    )
  );
});
