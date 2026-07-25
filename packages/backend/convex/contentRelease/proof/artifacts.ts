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
import type { ProofPage } from "@repo/backend/convex/contentRelease/proof/read";
import { Effect, Stream } from "effect";

/** Authenticates every staged artifact against the frozen renderer snapshot. */
export const verifyArtifacts = Effect.fn("contentRelease.verifyArtifacts")(
  function* <E, R>(
    rows: Stream.Stream<ProofPage["rows"][number], E, R>,
    releaseId: string,
    renderer: RendererManifestEnvelope,
    rendererContractVersion: RendererContractVersion
  ) {
    return yield* rows.pipe(
      Stream.runFoldEffect(0, (count, row) =>
        Effect.gen(function* () {
          const item = yield* decodeItemJson(row.itemJson);
          if (item.change.operation === "delete") {
            if (row.artifactJson !== undefined) {
              return yield* releaseFail(
                "CONTENT_RELEASE_INTEGRITY",
                `Delete item ${releaseId}/${row.index} has an artifact.`
              );
            }
            return count;
          }
          if (!row.artifactJson) {
            return yield* releaseFail(
              "CONTENT_RELEASE_MISSING",
              `Upsert item ${releaseId}/${row.index} has no artifact.`
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
            verified.payload.locale !== item.change.locale ||
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
  }
);
