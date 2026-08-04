"use node";

import { verifyContentProjections } from "@nakafa/aksara-contracts/projection/verify";
import type { SignedContentRelease } from "@nakafa/aksara-contracts/release";
import { verifyContentReleaseItems } from "@nakafa/aksara-contracts/release/items";
import { verifyRollbackSnapshot } from "@nakafa/aksara-contracts/release/rollback/digest";
import type { RendererManifestEnvelope } from "@nakafa/aksara-contracts/renderer/contract";
import {
  decodeRollbackJson,
  parseStoredJson,
} from "@repo/backend/convex/contentRelease/parse";
import { verifyArtifactStream } from "@repo/backend/convex/contentRelease/proof/artifact";
import { contractFailure } from "@repo/backend/convex/contentRelease/proof/failure";
import type { ProofPage } from "@repo/backend/convex/contentRelease/proof/read";
import { Effect, Option, Stream } from "effect";

type ProofRow = ProofPage["rows"][number];

/** Verifies the item, projection, and rollback digests from one row stream. */
const verifyDigestStreams = Effect.fn(
  "contentRelease.verifyContentDigestStreams"
)(function* <StreamError, Requirements>(
  release: SignedContentRelease,
  rows: Stream.Stream<ProofRow, StreamError, Requirements>
) {
  const decodedRows = rows.pipe(
    Stream.mapEffect((row) =>
      Effect.gen(function* () {
        const item = yield* parseStoredJson(row.itemJson);
        const rollback = yield* decodeRollbackJson(row.rollbackJson);
        let projection = Option.none<unknown>();
        if (row.projectionJson !== undefined) {
          projection = Option.some(yield* parseStoredJson(row.projectionJson));
        }
        return { item, projection, rollback };
      })
    )
  );
  return yield* decodedRows.pipe(
    Stream.broadcast(3, 16),
    Effect.flatMap(([itemRows, projectionRows, rollbackRows]) =>
      Effect.all(
        {
          items: verifyContentReleaseItems({
            items: itemRows.pipe(Stream.map((row) => row.item)),
            manifest: release.manifest,
          }),
          projections: verifyContentProjections({
            manifest: release.manifest,
            projections: projectionRows.pipe(
              Stream.filterMap((row) => row.projection)
            ),
          }),
          rollback: verifyRollbackSnapshot({
            entries: rollbackRows.pipe(Stream.map((row) => row.rollback)),
            manifest: release.manifest,
          }),
        },
        { concurrency: "unbounded" }
      )
    ),
    Effect.mapError(contractFailure)
  );
});

/** Reauthenticates artifacts and verifies all digests from one stored-row pass. */
export const verifyContentStreams = Effect.fn(
  "contentRelease.verifyContentProofStreams"
)(function* <StreamError, Requirements>(
  release: SignedContentRelease,
  renderer: RendererManifestEnvelope,
  rows: Stream.Stream<ProofRow, StreamError, Requirements>
) {
  return yield* rows.pipe(
    Stream.broadcast(2, 16),
    Effect.flatMap(([artifactRows, digestRows]) =>
      Effect.all(
        {
          artifacts: verifyArtifactStream(
            artifactRows,
            release.manifest.releaseId,
            renderer,
            release.manifest.rendererContractVersion
          ),
          digests: verifyDigestStreams(release, digestRows),
        },
        { concurrency: "unbounded" }
      )
    ),
    Effect.map(({ artifacts, digests }) => ({ ...digests, artifacts })),
    Effect.scoped
  );
});
