"use node";

import { verifyContentProjections } from "@nakafa/aksara-contracts/projection/verify";
import type { SignedContentRelease } from "@nakafa/aksara-contracts/release";
import { verifyContentReleaseItems } from "@nakafa/aksara-contracts/release/items";
import { verifyRollbackSnapshot } from "@nakafa/aksara-contracts/release/rollback/digest";
import {
  decodeRollbackJson,
  parseStoredJson,
} from "@repo/backend/convex/contentRelease/parse";
import { contractFailure } from "@repo/backend/convex/contentRelease/proof/failure";
import type { ProofPage } from "@repo/backend/convex/contentRelease/proof/read";
import { Effect, Option, Result, Stream } from "effect";

type ProofRow = ProofPage["rows"][number];

/** Verifies the item, projection, and rollback digests from one row stream. */
export const verifyContentStreams = Effect.fn(
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
    Stream.broadcastN({ capacity: 16, n: 3 }),
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
              Stream.filterMap((row) =>
                Option.match(row.projection, {
                  onNone: () => Result.failVoid,
                  onSome: Result.succeed,
                })
              )
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
    Effect.mapError(contractFailure),
    Effect.scoped
  );
});
