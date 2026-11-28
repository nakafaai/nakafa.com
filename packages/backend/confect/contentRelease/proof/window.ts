"use node";

import type { ContentSnapshotKind } from "@nakafa/aksara-contracts/release/snapshot/scope";
import contentReleaseInternal from "@repo/backend/confect/_generated/refs/contentRelease.server";
import { QueryRunner } from "@repo/backend/confect/_generated/services";
import { releaseFail } from "@repo/backend/confect/contentRelease/error";
import { parseStoredJson } from "@repo/backend/confect/contentRelease/parse";
import { Array as Arr, Effect, Stream } from "effect";

/**
 * Batches the proof joins into one row page. A release stages snapshots in
 * batches of at most 16 rows, so reading them one per query cost the proof over
 * 1,400 sequential Convex round trips and ran it past the publisher's
 * ten-minute window.
 */
const PROOF_RUN_BATCHES = 64;
/** Row JSON one page may start another batch under: a few MiB per round trip. */
const PROOF_RUN_BYTES = 4 * 1024 * 1024;
/**
 * Windows one replay reads at once. The 32,901-row assessment snapshot holds
 * about 130 MB of row JSON, and its proof replays it three times; read one page
 * at a time, those replays alone outran an action's ten minutes.
 */
const PROOF_WINDOW_CONCURRENCY = 4;

/**
 * Reads the rows of one fixed window of batches. A page stops early once its
 * row JSON passes `maxBytes`, so the window continues from where the page
 * stopped until it holds every batch it names.
 */
export const readSnapshotWindow = Effect.fn(
  "contentRelease.readProofSnapshotWindow"
)(function* (
  releaseId: string,
  family: ContentSnapshotKind,
  firstBatchIndex: number,
  batches: number,
  maxBytes: number
) {
  const { runQuery } = yield* QueryRunner;
  const lastBatchIndex = firstBatchIndex + batches - 1;
  let afterBatchIndex = firstBatchIndex - 1;
  let rowJson: readonly string[] = [];
  while (afterBatchIndex < lastBatchIndex) {
    const page = yield* runQuery(contentReleaseInternal.snapshot.read.rows, {
      afterBatchIndex,
      family,
      maxBatches: lastBatchIndex - afterBatchIndex,
      maxBytes,
      releaseId,
    }).pipe(Effect.catchTag("SchemaError", Effect.die));
    if (page.done && page.nextBatchIndex < lastBatchIndex) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Release ${releaseId} lost ${family} snapshot batches before ${lastBatchIndex}.`
      );
    }
    rowJson = Arr.appendAll(rowJson, page.rowJson);
    afterBatchIndex = page.nextBatchIndex;
  }
  return rowJson;
});

/**
 * Creates one replayable family row stream from exact release batch ledgers:
 * fixed windows of batches, read a few at once and emitted in ledger order.
 */
export function snapshotFamilyRows(
  releaseId: string,
  family: ContentSnapshotKind
) {
  return Stream.unwrap(
    QueryRunner.pipe(
      Effect.flatMap(({ runQuery }) =>
        runQuery(contentReleaseInternal.snapshot.read.batchCount, {
          family,
          releaseId,
        })
      ),
      Effect.catchTag("SchemaError", Effect.die),
      Effect.map((batchCount) =>
        Stream.range(0, Math.ceil(batchCount / PROOF_RUN_BATCHES) - 1).pipe(
          Stream.mapEffect(
            (window) => {
              const firstBatchIndex = window * PROOF_RUN_BATCHES;
              return readSnapshotWindow(
                releaseId,
                family,
                firstBatchIndex,
                Math.min(PROOF_RUN_BATCHES, batchCount - firstBatchIndex),
                PROOF_RUN_BYTES
              );
            },
            { concurrency: PROOF_WINDOW_CONCURRENCY }
          ),
          Stream.flattenIterable
        )
      )
    )
  ).pipe(Stream.mapEffect(parseStoredJson));
}
